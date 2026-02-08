import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { apiRequest } from '@/lib/queryClient';
import { getInitData, initializeTelegramWebApp } from '@/lib/telegram';
import { useAuth } from '@/lib/auth';
import ChatInterface from '@/components/chat-interface';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import type { ChatUser, ChatMessage, AuthUser } from '@/types';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 3000;
const TYPING_TIMEOUT = 3000; // Stop showing typing indicator after 3 seconds of inactivity
const MESSAGES_PER_PAGE = 50;

export default function ChatPage() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const onlineCountTimeout = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);
  const { toast } = useToast();
  const [devMode, setDevMode] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    initializeTelegramWebApp();
  }, []);

  // Redirect to entry if not authenticated
  useEffect(() => {
    if (!auth.user || !auth.token) {
      logger.log('[Chat] Not authenticated, redirecting to entry');
      setLocation('/entry');
      return; // Don't try to connect WebSocket
    }
  }, [auth.user, auth.token, setLocation]);

  // Preload chat history via REST API before WebSocket connects
  useEffect(() => {
    if (!auth.user || !auth.token) {
      return;
    }

    let isMounted = true;

    const preloadHistory = async () => {
      try {
        // Preload last 50 messages from REST API with pagination info
        const response = await apiRequest('GET', `/api/messages/1?limit=${MESSAGES_PER_PAGE}&paginated=true`);
        if (response.ok && isMounted) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            logger.log('[Chat] Preloaded', data.messages.length, 'messages');
            setMessages(data.messages);
            setHasMoreMessages(data.hasMore || false);
            // Track oldest message ID for pagination
            const firstMsg = data.messages[0];
            if (firstMsg) {
              setOldestMessageId(firstMsg.id);
            }
          }
        }
      } catch (error) {
        logger.error('[Chat] Failed to preload history:', error);
      }
    };

    preloadHistory();

    return () => {
      isMounted = false;
    };
  }, [auth.user?.id]);

  // WebSocket connection - only connect once when user is available
  useEffect(() => {
    if (!auth.user || !auth.token) {
      logger.log('[Chat] Skipping WebSocket - no auth');
      return;
    }

    // Don't reconnect if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      logger.log('[Chat] WebSocket already connected or connecting');
      return;
    }

    let isMounted = true;

    const connect = async () => {
      if (isMounted) {
        await connectWebSocket();
      }
    };

    connect();

    return () => {
      isMounted = false;
      // Clear any pending timeouts
      if (onlineCountTimeout.current) {
        clearTimeout(onlineCountTimeout.current);
      }
      // Clear typing timeouts
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.current.clear();
      // Only close if component is unmounting
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        logger.log('[Chat] Closing WebSocket on unmount');
        wsRef.current.close();
      }
    };
  }, [auth.user?.id]); // Only depend on user ID, not the entire user object or token

  const connectWebSocket = async () => {
    if (!auth.user || !auth.token) {
      logger.error('[Chat] Cannot connect WebSocket: missing auth data');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting.current) {
      logger.log('[Chat] Connection already in progress, skipping');
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      logger.log('[Chat] WebSocket already connected');
      return;
    }

    isConnecting.current = true;

    // Close existing connection if any
    if (wsRef.current) {
      logger.log('[Chat] Closing existing WebSocket before reconnect');
      wsRef.current.close();
      wsRef.current = null;
    }

    // Determine WebSocket URL - support both browser and Telegram Mini App
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;
    
    // If running in Telegram Mini App or host is undefined/empty, use environment variable or fallback
    if (!wsHost || wsHost === 'undefined' || wsHost === '' || wsHost === 'undefined:undefined' || wsHost.includes('undefined')) {
      // In Telegram Mini App, use the origin from window.location if available
      if (window.location.origin && !window.location.origin.includes('undefined')) {
        try {
          const url = new URL(window.location.origin);
          wsHost = url.host;
        } catch (e) {
          // Fallback to localhost
          wsHost = 'localhost:3000';
        }
      } else {
        wsHost = import.meta.env.VITE_WS_HOST || 'localhost:3000';
      }
    }
    
    const wsUrl = `${protocol}//${wsHost}/ws`;
    
    logger.log('[Chat] Connecting to WebSocket...', { userId: auth.user.id, wsUrl });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      logger.log('[Chat] WebSocket connected, authenticating...');
      setIsConnected(true);
      reconnectAttempts.current = 0;
      isConnecting.current = false;
      
      // Get valid token for WebSocket auth
      const validToken = await auth.getValidToken();
      if (!validToken) {
        logger.error('[Chat] No valid token for WebSocket auth');
        ws.close();
        return;
      }
      
      // Authenticate with token
      ws.send(JSON.stringify({
        type: 'auth',
        token: validToken
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'auth_success':
            setRoomId(data.roomId);
            break;
            
          case 'auth_error':
            logger.error('WebSocket auth error:', data.message);
            // Ignore auth errors in simplified mode
            break;
            
          case 'chat_history':
            // Only update if we don't have messages preloaded
            setMessages(prev => {
              // If we already have messages (preloaded), merge new ones without duplicates
              if (prev.length > 0) {
                const wsMessages: ChatMessage[] = data.messages || [];
                const existingIds = new Set(prev.map((msg: ChatMessage) => msg.id));
                const newMessages = wsMessages.filter((msg: ChatMessage) => !existingIds.has(msg.id));
                return [...prev, ...newMessages];
              }
              // Otherwise, just set the messages from WebSocket
              return data.messages || [];
            });
            break;
            
          case 'new_message':
            // Optimized message addition
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              if (prev.some(msg => msg.id === data.message.id)) {
                return prev;
              }
              return [...prev, data.message];
            });
            // Send delivery receipt for messages from other users
            if (auth.user && data.message.user?.id !== auth.user.id) {
              sendDeliveryReceipt(data.message.id);
              sendReadReceipt(data.message.id);
            }
            break;
            
          case 'delivery_receipt':
            // Update message delivery status
            setMessages(prev => prev.map(msg => 
              msg.id === data.messageId 
                ? { ...msg, deliveredTo: [...(msg.deliveredTo || []), data.userId] }
                : msg
            ));
            break;

          case 'read_receipt':
            // Update message read status
            setMessages(prev => prev.map(msg => 
              msg.id === data.messageId 
                ? { ...msg, readBy: [...(msg.readBy || []), data.userId] }
                : msg
            ));
            break;
            
          case 'user_typing':
            handleTypingIndicator(data.userId, data.isTyping);
            break;

          case 'online_count':
            // Debounce online count updates to reduce UI flicker
            if (onlineCountTimeout.current) {
              clearTimeout(onlineCountTimeout.current);
            }
            onlineCountTimeout.current = setTimeout(() => {
              setTotalUsers(data.totalUsers || 0);
              setOnlineCount(data.count || 0);
              onlineCountTimeout.current = null;
            }, 300);
            break;

          case 'error':
            // Check if profile is incomplete and redirect to registration
            if (data.code === 'PROFILE_INCOMPLETE') {
              toast({
                variant: "destructive",
                title: "Профиль не заполнен",
                description: "Пожалуйста, заполните профиль перед отправкой сообщений"
              });
              setTimeout(() => setLocation('/register'), 2000);
            } else {
              toast({
                variant: "destructive",
                title: "Ошибка",
                description: data.message
              });
            }
            break;
            
          default:
            logger.log('Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      logger.log('[Chat] WebSocket disconnected', { code: event.code, reason: event.reason });
      setIsConnected(false);
      isConnecting.current = false;
      
      // Don't reconnect if closed normally (1000) or by duplicate connection (same code)
      if (event.code === 1000 && event.reason === 'New connection established') {
        logger.log('[Chat] Connection closed due to duplicate, not reconnecting');
        reconnectAttempts.current = 0;
        return;
      }
      
      // Don't reconnect if closed due to auth error
      if (event.code === 1008 || event.code === 1011) {
        logger.log('[Chat] Connection closed due to auth error, attempting token refresh');
        auth.handleAuthError().then(refreshed => {
          if (refreshed) {
            logger.log('[Chat] Token refreshed, will reconnect');
            reconnectAttempts.current = 0;
            setTimeout(() => connectWebSocket(), 1000);
          }
        });
        return;
      }
      
      // Only attempt reconnect if we still have valid auth
      if (!auth.user || !auth.token) {
        logger.log('[Chat] No auth data, skipping reconnect');
        return;
      }
      
      // Reconnect after delay if still authenticated and under max attempts
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        logger.log(`[Chat] Reconnecting... Attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}`);
        
        setTimeout(() => {
          // Double-check auth is still valid before reconnecting
          if (auth.user && auth.token) {
            connectWebSocket();
          } else {
            logger.log('[Chat] Auth lost during reconnect delay');
          }
        }, RECONNECT_INTERVAL);
      } else {
        logger.log('[Chat] Max reconnection attempts reached');
        toast({
          variant: "destructive",
          title: "Соединение потеряно",
          description: "Не удалось переподключиться. Пожалуйста, перезагрузите страницу."
        });
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
      setIsConnected(false);
      isConnecting.current = false;
    };
  };


  const handleTypingIndicator = (userId: number, isTyping: boolean) => {
    if (isTyping) {
      // Add user to typing set
      setTypingUsers(prev => new Set(prev).add(userId));

      // Clear existing timeout for this user
      const existingTimeout = typingTimeouts.current.get(userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout to remove user from typing
      const timeout = setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        typingTimeouts.current.delete(userId);
      }, TYPING_TIMEOUT);

      typingTimeouts.current.set(userId, timeout);
    } else {
      // Remove user from typing set
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });

      // Clear timeout
      const existingTimeout = typingTimeouts.current.get(userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        typingTimeouts.current.delete(userId);
      }
    }
  };

  const sendTypingStart = () => {
    if (wsRef.current && isConnected && roomId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_start',
        roomId
      }));
    }
  };

  const sendTypingEnd = () => {
    if (wsRef.current && isConnected && roomId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_end',
        roomId
      }));
    }
  };

  const sendDeliveryReceipt = (messageId: number) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'message_delivered',
        messageId
      }));
    }
  };

  const sendReadReceipt = (messageId: number) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'message_read',
        messageId
      }));
    }
  };

  const handleInputChange = () => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing_start
    sendTypingStart();

    // Set timeout to send typing_end after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingEnd();
    }, TYPING_TIMEOUT);
  };

  const handleSendMessage = (content: string, replyTo?: { id: number; anonName: string; content: string }) => {
    if (wsRef.current && isConnected) {
      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingEnd();

      // Send message with optional reply data
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        content,
        roomId,
        replyTo
      }));
    }
  };

  // Load more (older) messages
  const handleLoadMore = async () => {
    if (isLoadingMore || !oldestMessageId || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    try {
      const response = await apiRequest(
        'GET', 
        `/api/messages/1?limit=${MESSAGES_PER_PAGE}&cursor=${oldestMessageId}&direction=before&paginated=true`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          logger.log('[Chat] Loaded', data.messages.length, 'more messages');
          
          // Prepend older messages
          setMessages(prev => [...data.messages, ...prev]);
          setHasMoreMessages(data.hasMore || false);
          
          // Update oldest message ID
          const firstMsg = data.messages[0];
          if (firstMsg) {
            setOldestMessageId(firstMsg.id);
          }
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      logger.error('[Chat] Failed to load more messages:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить сообщения",
        variant: "destructive"
      });
    } finally {
      setIsLoadingMore(false);
    }
  };


  // Show chat only if authenticated
  if (!auth.user) {
    return null;
  }

  return (
    <ChatInterface
      user={auth.user}
      messages={messages}
      onSendMessage={handleSendMessage}
      onInputChange={handleInputChange}
      onLoadMore={handleLoadMore}
      hasMoreMessages={hasMoreMessages}
      isLoadingMore={isLoadingMore}
      isConnected={isConnected}
      totalUsers={totalUsers}
      onlineCount={onlineCount}
      typingUsers={Array.from(typingUsers)}
    />
  );
}
