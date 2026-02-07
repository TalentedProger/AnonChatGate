import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import validator from 'validator';
import { storage } from './storage';
import { insertMessageSchema, users } from '@shared/schema';
import { verifyAuthToken } from './auth';
import { logger, logWebSocket, logError } from './logger';
import { db } from './db';
import { eq, sql } from 'drizzle-orm';
import { RATE_LIMIT, MESSAGE, WEBSOCKET } from './config';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  userStatus?: string;
}

// Rate limiting for WebSocket messages
interface RateLimitData {
  count: number;
  resetTime: number;
}

const userMessageCounts = new Map<number, RateLimitData>();

function checkRateLimit(userId: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userData = userMessageCounts.get(userId);

  // If no data or window expired, create new entry
  if (!userData || now > userData.resetTime) {
    userMessageCounts.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.WINDOW_MS
    });
    return { 
      allowed: true, 
      remaining: RATE_LIMIT.MESSAGE_LIMIT - 1,
      resetIn: RATE_LIMIT.WINDOW_MS
    };
  }

  // Check if limit exceeded
  if (userData.count >= RATE_LIMIT.MESSAGE_LIMIT) {
    return { 
      allowed: false, 
      remaining: 0,
      resetIn: userData.resetTime - now
    };
  }

  // Increment count
  userData.count++;
  userMessageCounts.set(userId, userData);
  
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.MESSAGE_LIMIT - userData.count,
    resetIn: userData.resetTime - now
  };
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(userMessageCounts.entries());
  for (const [userId, data] of entries) {
    if (now > data.resetTime) {
      userMessageCounts.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Sanitize user input to prevent XSS and other injection attacks
 * Removes HTML tags, script tags, and potentially dangerous characters
 */
function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove all HTML tags and entities
  let sanitized = validator.stripLow(input);
  
  // Escape HTML special characters
  sanitized = validator.escape(sanitized);
  
  // Remove any remaining script-like patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Normalize whitespace but preserve line breaks
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

// Global WebSocket server instance for tracking online users
let globalWss: WebSocketServer | null = null;

// Get count of online users (unique authenticated WebSocket connections)
export function getOnlineUsersCount(): number {
  if (!globalWss) return 0;
  
  const uniqueUserIds = new Set<number>();
  globalWss.clients.forEach((client: WebSocket) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.userId && ws.readyState === WebSocket.OPEN) {
      uniqueUserIds.add(ws.userId);
    }
  });
  return uniqueUserIds.size;
}

// Throttle broadcasts to prevent spam
let lastBroadcastTime = 0;
let pendingBroadcastTimeout: NodeJS.Timeout | null = null;

// Broadcast online count to all authenticated clients
function broadcastOnlineCount(wss: WebSocketServer) {
  const now = Date.now();
  
  // Clear any pending broadcast
  if (pendingBroadcastTimeout) {
    clearTimeout(pendingBroadcastTimeout);
    pendingBroadcastTimeout = null;
  }
  
  // If enough time has passed, broadcast immediately
  if (now - lastBroadcastTime >= WEBSOCKET.BROADCAST_THROTTLE_MS) {
    executeBroadcast(wss).catch(err => {
      logger.error({ error: err }, 'Failed to broadcast online count');
    });
    lastBroadcastTime = now;
  } else {
    // Otherwise, schedule a broadcast for later
    const delay = WEBSOCKET.BROADCAST_THROTTLE_MS - (now - lastBroadcastTime);
    pendingBroadcastTimeout = setTimeout(() => {
      executeBroadcast(wss).catch(err => {
        logger.error({ error: err }, 'Failed to broadcast online count');
      });
      lastBroadcastTime = Date.now();
      pendingBroadcastTimeout = null;
    }, delay);
  }
}

async function executeBroadcast(wss: WebSocketServer) {
  const onlineCount = getOnlineUsersCount();
  
  // Get total approved users from database
  const totalUsersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.status, 'approved'));
  
  const totalUsers = totalUsersResult[0]?.count || 0;
  
  const message = JSON.stringify({
    type: 'online_count',
    count: onlineCount,
    totalUsers: Number(totalUsers)
  });
  
  wss.clients.forEach((client: WebSocket) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.userId && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws',
    maxPayload: MESSAGE.MAX_SIZE_BYTES // Enforce at WebSocket level
  });
  globalWss = wss;

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    logWebSocket('connection', undefined, { event: 'new_connection' });
    
    // Close old connections from the same user when they reconnect
    ws.on('authenticated', (userId: number) => {
      wss.clients.forEach((client: WebSocket) => {
        const existingWs = client as AuthenticatedWebSocket;
        // Close other connections from the same user
        if (existingWs !== ws && existingWs.userId === userId && existingWs.readyState === WebSocket.OPEN) {
          logger.info({ userId }, 'Closing duplicate connection for user');
          existingWs.close(1000, 'New connection established');
        }
      });
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'auth':
            await handleAuth(ws, message);
            break;

          case 'send_message':
            await handleSendMessage(ws, message);
            break;

          case 'join_room':
            await handleJoinRoom(ws, message);
            break;

          case 'typing_start':
            handleTypingStart(ws, message, wss);
            break;

          case 'typing_end':
            handleTypingEnd(ws, message, wss);
            break;

          case 'message_delivered':
            await handleMessageDelivered(ws, message, wss);
            break;

          case 'message_read':
            await handleMessageRead(ws, message, wss);
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Unknown message type'
            }));
        }
      } catch (error) {
        if (error instanceof Error) {
          logError(error, { context: 'websocket_message' });
        }
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      logWebSocket('disconnect', ws.userId, { event: 'connection_closed' });
      // Broadcast updated online count when user disconnects
      setTimeout(() => broadcastOnlineCount(wss), 100);
    });
  });

  async function handleAuth(ws: AuthenticatedWebSocket, message: any) {
    try {
      const { token } = message;
      
      logWebSocket('auth_attempt', undefined);
      
      // Token is always required
      if (!token) {
        logger.warn('WebSocket: No token provided');
        ws.send(JSON.stringify({
          type: 'auth_error',
          message: 'Authentication token required',
          code: 'NO_TOKEN'
        }));
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify the JWT token
      const tokenData = verifyAuthToken(token);
      if (!tokenData) {
        logger.warn('WebSocket: Token verification failed');
        ws.send(JSON.stringify({
          type: 'auth_error',
          message: 'Invalid or expired authentication token',
          code: 'INVALID_TOKEN'
        }));
        ws.close(1008, 'Invalid token');
        return;
      }

      // Verify user still exists
      const user = await storage.getUserById(tokenData.userId);
      
      if (!user) {
        logger.warn({ userId: tokenData.userId }, 'WebSocket: User not found in database');
        ws.send(JSON.stringify({
          type: 'error',
          message: 'User not found'
        }));
        return;
      }
      
      // Authentication successful
      ws.userId = user.id;
      ws.userStatus = user.status;
      
      // Emit authenticated event to close duplicate connections
      ws.emit('authenticated', user.id);
      
      logWebSocket('auth_success', user.id);

      // Load chat history
      const globalRoom = await storage.getOrCreateGlobalRoom();
      const messages = await storage.getMessagesByRoomId(globalRoom.id, 50);

      ws.send(JSON.stringify({
        type: 'auth_success',
        user: {
          id: user.id,
          anonName: user.anonName,
          status: user.status
        },
        roomId: globalRoom.id
      }));

      ws.send(JSON.stringify({
        type: 'chat_history',
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          user: msg.user ? {
            id: msg.user.id,
            anonName: msg.user.anonName
          } : null
        }))
      }));

      // Broadcast updated online count to all clients
      broadcastOnlineCount(wss);

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'websocket_auth' });
      }
      ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Authentication failed'
      }));
      ws.close(1011, 'Authentication error');
    }
  }

  async function handleSendMessage(ws: AuthenticatedWebSocket, message: any) {
    try {
      if (!ws.userId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Not authenticated'
        }));
        return;
      }

      // Rate limiting check (skip in development)
      if (process.env.NODE_ENV !== 'development') {
        const rateLimitResult = checkRateLimit(ws.userId);
        if (!rateLimitResult.allowed) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Слишком много сообщений. Попробуйте через ${Math.ceil(rateLimitResult.resetIn / 1000)} секунд.`,
            code: 'RATE_LIMIT_EXCEEDED',
            resetIn: rateLimitResult.resetIn
          }));
          return;
        }
      }

      // Check if user has completed their profile
      const currentUser = await storage.getUserById(ws.userId);
      if (currentUser && currentUser.profileCompleted !== 'true') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Please complete your profile before sending messages',
          code: 'PROFILE_INCOMPLETE',
          redirectTo: '/register'
        }));
        return;
      }

      const { content, roomId } = message;
      
      // Validate message using insertMessageSchema
      const globalRoom = await storage.getOrCreateGlobalRoom();
      const targetRoomId = roomId || globalRoom.id;

      const messageData = {
        content: content,
        userId: ws.userId,
        roomId: targetRoomId
      };

      const validation = insertMessageSchema.safeParse(messageData);
      if (!validation.success) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Invalid message: ${validation.error.issues.map(i => i.message).join(', ')}`
        }));
        return;
      }

      // Additional content validation
      const trimmedContent = content?.trim();
      if (!trimmedContent || trimmedContent.length === 0) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Message content cannot be empty'
        }));
        return;
      }

      if (trimmedContent.length > MESSAGE.MAX_LENGTH) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Message is too long (max ${MESSAGE.MAX_LENGTH} characters)`
        }));
        return;
      }

      // Sanitize content to prevent XSS attacks
      const sanitizedContent = sanitizeInput(trimmedContent);
      
      if (!sanitizedContent || sanitizedContent.length === 0) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Message content contains invalid characters'
        }));
        return;
      }

      const newMessage = await storage.createMessage({
        content: sanitizedContent,
        userId: ws.userId,
        roomId: targetRoomId
      });

      logWebSocket('message_sent', ws.userId, { 
        messageId: newMessage.id, 
        roomId: targetRoomId 
      });

      const user = await storage.getUserById(ws.userId);
      
      // Broadcast message to all connected clients in the room
      const broadcastData = JSON.stringify({
        type: 'new_message',
        message: {
          id: newMessage.id,
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          user: {
            id: user?.id,
            anonName: user?.anonName
          }
        }
      });

      wss.clients.forEach((client: AuthenticatedWebSocket) => {
        if (client.readyState === WebSocket.OPEN && 
            client.userId && 
            client.userId) {
          client.send(broadcastData);
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { 
          context: 'websocket_send_message', 
          userId: ws.userId 
        });
      }
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to send message'
      }));
      
      // Close connection on repeated errors (security measure)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('Invalid')) {
        ws.close(1011, 'Message error');
      }
    }
  }

  async function handleJoinRoom(ws: AuthenticatedWebSocket, message: any) {
    // For MVP, we only have global room
    const globalRoom = await storage.getOrCreateGlobalRoom();
    ws.send(JSON.stringify({
      type: 'joined_room',
      roomId: globalRoom.id,
      roomName: 'Общий чат'
    }));
  }

  function handleTypingStart(ws: AuthenticatedWebSocket, message: any, wss: WebSocketServer) {
    if (!ws.userId) {
      return;
    }

    const { roomId } = message;
    
    logWebSocket('typing_start', ws.userId, { roomId });

    // Broadcast to all other clients in the room
    wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && 
          client.userId && 
          client.userId !== ws.userId) {
        client.send(JSON.stringify({
          type: 'user_typing',
          userId: ws.userId,
          roomId,
          isTyping: true
        }));
      }
    });
  }

  function handleTypingEnd(ws: AuthenticatedWebSocket, message: any, wss: WebSocketServer) {
    if (!ws.userId) {
      return;
    }

    const { roomId } = message;
    
    logWebSocket('typing_end', ws.userId, { roomId });

    // Broadcast to all other clients in the room
    wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && 
          client.userId && 
          client.userId !== ws.userId) {
        client.send(JSON.stringify({
          type: 'user_typing',
          userId: ws.userId,
          roomId,
          isTyping: false
        }));
      }
    });
  }

  async function handleMessageDelivered(ws: AuthenticatedWebSocket, message: any, wss: WebSocketServer) {
    if (!ws.userId) {
      return;
    }

    const { messageId } = message;
    
    try {
      // Get the message
      const msg = await storage.getMessageById(messageId);
      if (!msg) {
        return;
      }

      // Add user to deliveredTo array if not already there
      const deliveredTo = msg.deliveredTo || [];
      if (!deliveredTo.includes(ws.userId)) {
        await storage.updateMessageDelivery(messageId, [...deliveredTo, ws.userId]);
        
        logWebSocket('message_delivered', ws.userId, { messageId });

        // Notify the message sender
        wss.clients.forEach((client: AuthenticatedWebSocket) => {
          if (client.readyState === WebSocket.OPEN && client.userId === msg.userId) {
            client.send(JSON.stringify({
              type: 'delivery_receipt',
              messageId,
              userId: ws.userId
            }));
          }
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'message_delivered', userId: ws.userId, messageId });
      }
    }
  }

  async function handleMessageRead(ws: AuthenticatedWebSocket, message: any, wss: WebSocketServer) {
    if (!ws.userId) {
      return;
    }

    const { messageId } = message;
    
    try {
      // Get the message
      const msg = await storage.getMessageById(messageId);
      if (!msg) {
        return;
      }

      // Add user to readBy array if not already there
      const readBy = msg.readBy || [];
      if (!readBy.includes(ws.userId)) {
        await storage.updateMessageRead(messageId, [...readBy, ws.userId]);
        
        logWebSocket('message_read', ws.userId, { messageId });

        // Notify the message sender
        wss.clients.forEach((client: AuthenticatedWebSocket) => {
          if (client.readyState === WebSocket.OPEN && client.userId === msg.userId) {
            client.send(JSON.stringify({
              type: 'read_receipt',
              messageId,
              userId: ws.userId
            }));
          }
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'message_read', userId: ws.userId, messageId });
      }
    }
  }

  return wss;
}
