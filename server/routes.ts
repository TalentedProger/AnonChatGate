import type { Express, RequestHandler } from "express";
import express from "express";
import { createServer, type Server } from "http";
import validator from "validator";
import { storage } from "./storage";
import { setupWebSocket } from "./websocket";
import { insertUserSchema, insertProfileSchema, usernameSchema, users } from "@shared/schema";
import { generateTokenPair, hashRefreshToken, verifyRefreshToken, verifyAuthToken } from "./auth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from 'crypto';
import querystring from 'querystring';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger, logAuth, logError } from './logger';
import * as statisticsController from './statistics';
import { AUTH, UPLOAD } from './config';
import { evaluateRoomAccess } from './room-access';
import { InvalidImageError, storeSanitizedImage } from './image-upload';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD.MAX_FILE_SIZE,
    files: UPLOAD.MAX_PHOTOS,
    fields: UPLOAD.MAX_PHOTOS + 1,
  },
});

function handleUploadErrors(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Image is too large' });
        return;
      }

      logger.warn({
        multerCode: error instanceof multer.MulterError ? error.code : undefined,
      }, 'Rejected malformed image upload');
      res.status(400).json({ error: 'Invalid image upload' });
    });
  };
}

const uploadSingleImage = handleUploadErrors(upload.single('image'));
const uploadMultipleImages = handleUploadErrors(upload.array('images', UPLOAD.MAX_PHOTOS));

/**
 * Delete file from disk
 */
async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    logger.error({ error, filePath }, 'Error deleting file');
  }
}

/**
 * Sanitize text input to prevent XSS attacks
 */
function sanitizeText(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  
  // Escape HTML special characters
  let sanitized = validator.escape(input);
  
  // Remove script patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized || undefined;
}

/**
 * Sanitize and validate URL
 */
function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  // Check if valid URL
  if (!validator.isURL(trimmed, { 
    protocols: ['http', 'https'],
    require_protocol: true 
  })) {
    return null;
  }
  
  return trimmed;
}

function parseInitData(initData: string) {
  return querystring.parse(initData);
}

function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = initData.split('&').map(p => p.split('='));
    const kv: Record<string, string> = {};
    
    for (const [k, v] of params) {
      if (!k) continue;
      kv[k] = decodeURIComponent(v || '');
    }
    
    const hash = kv['hash'];
    if (!hash) {
      logger.warn('Init data verification failed: no hash field');
      return false;
    }
    
    // Validate auth_date - reject if older than 24 hours
    const authDate = parseInt(kv['auth_date'] || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    
    if (!authDate || now - authDate > AUTH.INIT_DATA_MAX_AGE_SECONDS) {
      logger.warn({ authDate, now, diff: now - authDate, maxAge: AUTH.INIT_DATA_MAX_AGE_SECONDS }, 'Init data expired or missing auth_date');
      return false;
    }
    
    // Build data-check-string per Telegram docs:
    // sorted alphabetically, key=value pairs joined by \n, excluding 'hash'
    const keys = Object.keys(kv).filter(k => k !== 'hash').sort();
    const data_check_arr = keys.map(k => `${k}=${kv[k]}`);
    const data_check_string = data_check_arr.join('\n');

    // CRITICAL: Per Telegram docs, secret_key = HMAC_SHA256(bot_token, "WebAppData")
    // NOT just SHA256(bot_token)
    // See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secret).update(data_check_string).digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
    
    if (!isValid) {
      logger.warn({
        dataCheckFields: keys,
        authDate,
        timeDiff: now - authDate,
      }, 'Init data HMAC verification failed - hash mismatch');
    }
    
    return isValid;
  } catch (error) {
    if (error instanceof Error) {
      logger.error({ error: error.message }, 'Init data verification error');
    }
    return false;
  }
}

// Anonymous names are now auto-generated in storage.createUser as Student_{id}

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.substring(7);
  const user = verifyAuthToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Add user info to request
  req.user = user;
  next();
}

async function createPersistedTokenPair(user: {
  id: number;
  anonName: string | null;
  status: string;
}) {
  const tokens = generateTokenPair(user);

  await storage.createAuthSession({
    id: tokens.sessionId,
    userId: user.id,
    refreshTokenHash: hashRefreshToken(tokens.refreshToken),
    refreshTokenJti: tokens.refreshTokenId,
    expiresAt: tokens.refreshExpiresAt,
  });

  return tokens;
}

async function requireRoomAccess(req: any, res: any, next: any) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const user = await storage.getUserById(req.user.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists', code: 'USER_NOT_FOUND' });
    }

    const rawRoomId = req.params.roomId;
    let room;

    if (rawRoomId !== undefined) {
      if (typeof rawRoomId !== 'string' || !/^[1-9]\d*$/.test(rawRoomId)) {
        return res.status(400).json({ error: 'Invalid room ID', code: 'INVALID_ROOM_ID' });
      }

      room = await storage.getRoomById(Number(rawRoomId));
    } else {
      room = await storage.getOrCreateGlobalRoom();
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' });
    }

    const decision = evaluateRoomAccess(user, room);
    if (!decision.allowed) {
      return res.status(decision.status).json({ error: decision.message, code: decision.code });
    }

    req.chatUser = user;
    req.chatRoom = room;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup WebSocket
  setupWebSocket(httpServer);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Telegram Bot Webhook endpoint (for production)
  app.post('/api/telegram-webhook', async (req, res) => {
    try {
      // Dynamically import to avoid circular dependency and handle when bot is not initialized
      const { processWebhookUpdate, BOT_TOKEN } = await import('./telegram-bot');
      
      if (!BOT_TOKEN) {
        logger.warn('[Webhook] Bot token not configured, ignoring webhook');
        return res.sendStatus(200);
      }
      
      const update = req.body;
      
      if (!update || typeof update !== 'object') {
        logger.warn('[Webhook] Invalid update received');
        return res.sendStatus(400);
      }
      
      // Process the update
      processWebhookUpdate(update);
      
      // Always respond 200 to Telegram
      res.sendStatus(200);
    } catch (error) {
      logger.error({ error }, '[Webhook] Error handling update');
      // Still respond 200 to avoid Telegram retries
      res.sendStatus(200);
    }
  });

  // Development-only auth endpoint for testing
  app.post('/api/auth/dev', async (req, res) => {
    // CRITICAL SECURITY: Multiple layers of production protection
    
    // Primary check: NODE_ENV must not be production
    if (process.env.NODE_ENV === 'production') {
      logger.warn({ ip: req.ip }, '[SECURITY] Dev endpoint access attempt blocked in production');
      return res.status(403).json({ error: 'Dev endpoint not available in production' });
    }

    // Secondary check: Explicitly require DEV_MODE flag
    if (process.env.DEV_MODE !== 'true') {
      logger.warn({ ip: req.ip }, '[SECURITY] Dev endpoint access blocked - DEV_MODE not enabled');
      return res.status(403).json({ error: 'Dev endpoint disabled' });
    }

    // Note: JWT_SECRET length check removed - security is ensured by NODE_ENV and DEV_MODE checks above
    // Long JWT secrets are recommended even for development

    // Quaternary check: IP whitelist for dev endpoint
    const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const isLocalhost = allowedIPs.some(ip => clientIP.includes(ip));
    
    if (!isLocalhost) {
      logger.warn({ ip: clientIP }, '[SECURITY] Dev endpoint access blocked - non-local IP');
      return res.status(403).json({ error: 'Dev endpoint only available from localhost' });
    }

    try {
      // Allow specifying tgId for testing different users
      const { tgId } = req.body;
      
      // Generate unique random tgId if not provided (for dev/testing)
      // Use timestamp + random to ensure uniqueness
      const targetTgId = tgId ? BigInt(tgId) : BigInt(Date.now() + Math.floor(Math.random() * 10000));
      
      // Get the specified user
      let user = await storage.getUserByTgId(targetTgId);
      
      if (!user) {
        user = await storage.createUser({
          tgId: targetTgId,
          username: null,
          status: 'approved',
        });
        logger.debug({ userId: user.id, tgId: user.tgId }, '[DEV AUTH] Created new user with unique tgId');
      }

      const { token, refreshToken } = await createPersistedTokenPair(user);

      logAuth('dev_auth', user.id, true);
      logger.debug({ userId: user.id, anonName: user.anonName }, '[DEV AUTH] Authenticated user');

      res.json({
        user: {
          id: user.id,
          anonName: user.anonName,
          status: user.status,
          createdAt: user.createdAt,
        },
        status: user.status,
        token,
        refreshToken
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'dev_auth' });
      }
      res.status(500).json({ error: 'Dev authentication failed' });
    }
  });

  // Authentication endpoint
  app.post('/api/auth', async (req, res) => {
    try {
      const { initData } = req.body;
      
      logger.debug({
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
        contentType: req.headers['content-type'],
      }, 'Auth request received');
      
      if (!initData) {
        logger.warn('Auth failed: No initData provided');
        return res.status(400).json({ error: 'initData required' });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
      if (!botToken) {
        return res.status(500).json({ error: 'Bot token not configured' });
      }

      // Verify initData
      const isValid = verifyInitData(initData, botToken);
      if (!isValid) {
        logger.warn('Auth failed: Invalid initData');
        return res.status(401).json({ error: 'Invalid initData' });
      }

      // Parse user data from initData
      const parsed = parseInitData(initData);
      let userData = null;
      
      if (parsed.user && typeof parsed.user === 'string') {
        try {
          userData = JSON.parse(parsed.user);
        } catch (e) {
          if (e instanceof Error) {
            logger.error({ error: e.message }, 'Failed to parse user data from initData');
          }
        }
      }

      if (!userData || !userData.id) {
        return res.status(400).json({ error: 'Invalid user data in initData' });
      }

      const tgId = BigInt(userData.id);
      let user = await storage.getUserByTgId(tgId);

      // Create user if not exists
      if (!user) {
        user = await storage.createUser({
          tgId,
          username: userData.username || null,
          telegramPhotoUrl: userData.photo_url || null, // Store Telegram avatar
          status: 'approved',
        });
      } else if (userData.photo_url && user.telegramPhotoUrl !== userData.photo_url) {
        // Update Telegram photo if it changed
        await storage.updateUser(user.id, { telegramPhotoUrl: userData.photo_url });
        user.telegramPhotoUrl = userData.photo_url;
      }

      const { token, refreshToken } = await createPersistedTokenPair(user);

      logAuth('telegram_auth', user.id, true);

      res.json({
        user: {
          id: user.id,
          anonName: user.anonName,
          status: user.status,
          createdAt: user.createdAt,
        },
        status: user.status,
        token,
        refreshToken
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'telegram_auth' });
      }
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Token refresh endpoint
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      // Verify the refresh token
      const tokenData = verifyRefreshToken(refreshToken);
      if (!tokenData) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // Get current user data to ensure still valid
      const user = await storage.getUserById(tokenData.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if user status matches token (prevent using old tokens after status change)
      if (user.status !== tokenData.status) {
        await storage.revokeAuthSession(
          tokenData.sessionId,
          tokenData.userId,
          hashRefreshToken(refreshToken),
        );
        return res.status(401).json({ error: 'User status has changed. Please re-authenticate' });
      }

      // Rotate the refresh token without extending the session's original 7-day lifetime.
      const nextTokens = generateTokenPair(user, {
        sessionId: tokenData.sessionId,
        refreshExpiresAtSeconds: tokenData.expiresAt,
      });

      const rotatedSession = await storage.rotateAuthSession({
        sessionId: tokenData.sessionId,
        userId: tokenData.userId,
        previousTokenHash: hashRefreshToken(refreshToken),
        previousTokenId: tokenData.tokenId,
        nextTokenHash: hashRefreshToken(nextTokens.refreshToken),
        nextTokenId: nextTokens.refreshTokenId,
      });

      if (!rotatedSession) {
        logger.warn({ userId: tokenData.userId, sessionId: tokenData.sessionId }, 'Refresh token replay or revoked session rejected');
        return res.status(401).json({ error: 'Refresh token has already been used or revoked' });
      }

      logAuth('token_refresh', user.id, true);

      res.json({
        user: {
          id: user.id,
          anonName: user.anonName,
          status: user.status,
          createdAt: user.createdAt,
        },
        status: user.status,
        token: nextTokens.token,
        refreshToken: nextTokens.refreshToken
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'token_refresh' });
      }
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  // Revoke the current refresh-token session. The access token naturally expires within 15 minutes.
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
      const tokenData = refreshToken ? verifyRefreshToken(refreshToken) : null;

      if (tokenData) {
        await storage.revokeAuthSession(
          tokenData.sessionId,
          tokenData.userId,
          hashRefreshToken(refreshToken),
        );
        logAuth('logout', tokenData.userId, true);
      }

      // Logout is deliberately idempotent and does not disclose token/session validity.
      return res.sendStatus(204);
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'logout' });
      }
      return res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Get current user's profile
  app.get('/api/profile', requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Extract individual social links from array for frontend convenience
      const socialLinks = user.socialLinks || [];
      const telegram = socialLinks.find(link => link?.includes('t.me') || link?.includes('telegram')) || '';
      const vk = socialLinks.find(link => link?.includes('vk.com')) || '';
      const instagram = socialLinks.find(link => link?.includes('instagram')) || '';

      res.json({
        profile: {
          id: user.id,
          displayName: user.displayName,
          course: user.course,
          direction: user.direction,
          bio: user.bio,
          gender: user.gender,
          avatarUrl: user.avatarUrl,
          telegramPhotoUrl: user.telegramPhotoUrl, // Real Telegram avatar
          socialLinks: user.socialLinks || [],
          // Also return individual fields for convenience
          telegram,
          vk,
          instagram,
          photos: user.photos || [],
          profileCompleted: user.profileCompleted === 'true',
          anonName: user.anonName,
          status: user.status
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'get_profile', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Get another user's public profile (for viewing in chat)
  app.get('/api/user/:userId/profile', requireAuth, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return only public/anonymous profile data
      res.json({
        profile: {
          id: user.id,
          anonName: user.anonName,
          gender: user.gender,
          course: user.course,
          direction: user.direction,
          bio: user.bio,
          // Don't expose: displayName (real name), socialLinks, photos, etc.
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'get_user_profile', userId: req.params.userId });
      }
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  });

  // Check username availability
  app.get('/api/check-username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      
      // Validate username format
      try {
        usernameSchema.parse(username);
      } catch (error) {
        return res.json({ 
          available: false, 
          error: 'Неверный формат имени пользователя' 
        });
      }

      // Check if username exists (case-insensitive)
      const existingUsers = await db.select().from(users).where(eq(users.displayName, username.toLowerCase()));
      
      res.json({
        available: existingUsers.length === 0,
        error: existingUsers.length > 0 ? 'Имя пользователя уже занято' : null
      });

    } catch (error) {
      logger.error({ error }, 'Username check error');
      res.status(500).json({ error: 'Failed to check username' });
    }
  });

  // Update user profile
  app.patch('/api/profile', requireAuth, async (req: any, res) => {
    try {
      // Handle telegram, vk, instagram as individual fields and convert to socialLinks array
      const { telegram, vk, instagram, ...restBody } = req.body;
      
      // Build socialLinks array from individual fields
      const socialLinksFromFields: string[] = [];
      if (telegram && typeof telegram === 'string' && telegram.trim()) {
        socialLinksFromFields.push(telegram.trim());
      }
      if (vk && typeof vk === 'string' && vk.trim()) {
        socialLinksFromFields.push(vk.trim());
      }
      if (instagram && typeof instagram === 'string' && instagram.trim()) {
        socialLinksFromFields.push(instagram.trim());
      }
      
      // Merge with existing socialLinks if provided
      const existingSocialLinks = Array.isArray(restBody.socialLinks) ? restBody.socialLinks : [];
      const mergedSocialLinks = Array.from(new Set([...socialLinksFromFields, ...existingSocialLinks]));
      
      // Prepare data for validation
      const dataToValidate = {
        ...restBody,
        socialLinks: mergedSocialLinks.length > 0 ? mergedSocialLinks : undefined
      };
      
      // Validate profile data with Zod
      const profileData = insertProfileSchema.parse(dataToValidate);

      // Sanitize text fields to prevent XSS
      if (profileData.displayName) {
        const sanitized = sanitizeText(profileData.displayName);
        profileData.displayName = (sanitized || profileData.displayName).toLowerCase();
      }
      if (profileData.bio) {
        profileData.bio = sanitizeText(profileData.bio);
      }
      if (profileData.direction) {
        const sanitized = sanitizeText(profileData.direction);
        if (!sanitized) {
          return res.status(400).json({ error: 'Invalid direction field contains forbidden characters' });
        }
        profileData.direction = sanitized;
      }

      // Sanitize and validate URLs
      if (profileData.avatarUrl) {
        const sanitizedAvatar = sanitizeUrl(profileData.avatarUrl);
        if (!sanitizedAvatar) {
          return res.status(400).json({ error: 'Invalid avatar URL format' });
        }
        profileData.avatarUrl = sanitizedAvatar;
      }

      // Sanitize social links
      if (profileData.socialLinks && Array.isArray(profileData.socialLinks)) {
        profileData.socialLinks = profileData.socialLinks
          .map((link: any) => {
            if (typeof link === 'string') {
              return sanitizeUrl(link);
            }
            if (link && typeof link === 'object' && link.url) {
              const sanitizedUrl = sanitizeUrl(link.url);
              return sanitizedUrl ? { ...link, url: sanitizedUrl } : null;
            }
            return null;
          })
          .filter((link: any) => link !== null);
      }

      // Sanitize photo URLs
      if (profileData.photos && Array.isArray(profileData.photos)) {
        profileData.photos = profileData.photos
          .map((photo: string) => sanitizeUrl(photo))
          .filter((photo: string | null) => photo !== null) as string[];
      }

      // Update user profile directly with validated and sanitized data
      const updatedUser = await storage.updateUserProfile(req.user.userId, profileData);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Mark profile as completed if required fields are filled
      let finalUser = updatedUser;
      if (profileData.displayName && profileData.course && profileData.direction) {
        finalUser = await storage.markProfileCompleted(req.user.userId) || updatedUser;
      }

      // Extract individual social links from array for frontend convenience
      const responseSocialLinks = finalUser.socialLinks || [];
      const responseTelegram = responseSocialLinks.find(link => link?.includes('t.me') || link?.includes('telegram')) || '';
      const responseVk = responseSocialLinks.find(link => link?.includes('vk.com')) || '';
      const responseInstagram = responseSocialLinks.find(link => link?.includes('instagram')) || '';

      res.json({
        success: true,
        profile: {
          id: finalUser.id,
          displayName: finalUser.displayName,
          course: finalUser.course,
          direction: finalUser.direction,
          bio: finalUser.bio,
          gender: finalUser.gender,
          avatarUrl: finalUser.avatarUrl,
          socialLinks: finalUser.socialLinks || [],
          telegram: responseTelegram,
          vk: responseVk,
          instagram: responseInstagram,
          photos: finalUser.photos || [],
          profileCompleted: finalUser.profileCompleted === 'true',
          anonName: finalUser.anonName,
          status: finalUser.status
        }
      });

    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        // Zod validation error
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: (error as any).issues 
        });
      }

      logger.error({ error }, 'Update profile error');
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Get chat history with optional pagination
  app.get('/api/messages/:roomId?', requireAuth, requireRoomAccess, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
      const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
      const direction = (req.query.direction as 'before' | 'after') || 'before';
      const paginated = req.query.paginated === 'true';
      const targetRoomId = req.chatRoom.id;

      // Use paginated method if requested
      if (paginated || cursor) {
        const result = await storage.getMessagesPaginated(targetRoomId, {
          limit,
          cursor,
          direction
        });
        
        res.json({
          messages: result.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            replyToId: msg.replyToId,
            replyToAnonName: msg.replyToAnonName,
            replyToContent: msg.replyToContent,
            user: msg.user ? {
              id: msg.user.id,
              anonName: msg.user.anonName
            } : null,
            deliveredTo: msg.deliveredTo,
            readBy: msg.readBy
          })),
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          prevCursor: result.prevCursor
        });
      } else {
        // Legacy non-paginated response
        const messages = await storage.getMessagesByRoomId(targetRoomId, limit);
        
        res.json({
          messages: messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            replyToId: msg.replyToId,
            replyToAnonName: msg.replyToAnonName,
            replyToContent: msg.replyToContent,
            user: msg.user ? {
              id: msg.user.id,
              anonName: msg.user.anonName
            } : null
          }))
        });
      }

    } catch (error) {
      logger.error({ error }, 'Get messages error');
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  // Upload image endpoint
  app.post('/api/upload/image', requireAuth, uploadSingleImage, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const storedFile = await storeSanitizedImage(req.file.buffer, uploadDir);
      const imageUrl = `/uploads/${storedFile.filename}`;
      
      res.json({
        success: true,
        url: imageUrl,
        filename: storedFile.filename,
      });
    } catch (error) {
      if (error instanceof InvalidImageError) {
        return res.status(400).json({ error: 'Invalid image content' });
      }

      logger.error({ error }, 'Image upload error');
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  // Upload multiple images endpoint (for photos array)
  app.post('/api/upload/images', requireAuth, uploadMultipleImages, async (req, res) => {
    const storedFilePaths: string[] = [];

    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const filenames: string[] = [];
      let rejectedCount = 0;

      for (const file of files) {
        try {
          const storedFile = await storeSanitizedImage(file.buffer, uploadDir);
          filenames.push(storedFile.filename);
          storedFilePaths.push(storedFile.path);
        } catch (error) {
          if (error instanceof InvalidImageError) {
            rejectedCount += 1;
            continue;
          }

          throw error;
        }
      }

      if (filenames.length === 0) {
        return res.status(400).json({ error: 'No valid image files uploaded' });
      }

      const imageUrls = filenames.map(filename => `/uploads/${filename}`);
      
      res.json({
        success: true,
        urls: imageUrls,
        count: imageUrls.length,
        ...(rejectedCount > 0 && { rejectedCount }),
      });
    } catch (error) {
      await Promise.all(storedFilePaths.map(deleteFile));
      logger.error({ error }, 'Images upload error');
      res.status(500).json({ error: 'Failed to upload images' });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(uploadDir));

  // ============================================================================
  // STATISTICS ROUTES
  // ============================================================================

  // Get user statistics (popularity, friend requests)
  app.get('/api/statistics/user', requireAuth, statisticsController.getUserStatistics);

  // Record profile view
  app.post('/api/statistics/profile-view', requireAuth, statisticsController.recordProfileView);

  // Get chat statistics (total users, online users)
  app.get('/api/statistics/chat/:roomId?', statisticsController.getChatStatistics);

  // Get last message in room
  app.get('/api/statistics/last-message/:roomId', requireAuth, requireRoomAccess, statisticsController.getLastMessage);

  // Get top popular users
  app.get('/api/statistics/top-users', statisticsController.getTopPopularUsers);

  // Get news feed
  app.get('/api/news', statisticsController.getNewsFeed);

  // Create news item (for admin/testing)
  app.post('/api/news', requireAuth, statisticsController.createNewsItem);

  // ============================================================================
  // FAVORITES ROUTES
  // ============================================================================

  // Get current user's favorites
  app.get('/api/favorites', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const favoritesData = await storage.getUserFavorites(userId);
      
      // Get current month key for checking if user can add a new favorite
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthFavorite = await storage.getFavoriteByMonth(userId, currentMonthKey);
      
      res.json({
        favorites: favoritesData.map(f => ({
          id: f.id,
          favoriteUserId: f.favoriteUserId,
          favoriteUser: {
            id: f.favoriteUser.id,
            anonName: f.favoriteUser.anonName,
            gender: f.favoriteUser.gender,
            course: f.favoriteUser.course,
            direction: f.favoriteUser.direction,
          },
          createdAt: f.createdAt,
          monthKey: f.monthKey,
        })),
        canAddThisMonth: !currentMonthFavorite,
        currentMonthKey,
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'get_favorites', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to get favorites' });
    }
  });

  // Add a user to favorites (limited to 1 per month)
  app.post('/api/favorites/:userId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const favoriteUserId = parseInt(req.params.userId, 10);
      
      if (isNaN(favoriteUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      if (userId === favoriteUserId) {
        return res.status(400).json({ error: 'Cannot add yourself to favorites' });
      }
      
      // Check if user exists
      const favoriteUser = await storage.getUserById(favoriteUserId);
      if (!favoriteUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get current month key
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Check if user already has a favorite this month
      const existingFavorite = await storage.getFavoriteByMonth(userId, currentMonthKey);
      if (existingFavorite) {
        return res.status(400).json({ 
          error: 'Вы уже добавили избранного в этом месяце. Следующего можно добавить с начала следующего месяца.',
          existingFavoriteId: existingFavorite.favoriteUserId
        });
      }
      
      // Check if this user is already in favorites (from previous months)
      const isAlreadyFavorite = await storage.isFavorite(userId, favoriteUserId);
      if (isAlreadyFavorite) {
        return res.status(400).json({ error: 'Этот пользователь уже в избранном' });
      }
      
      // Add to favorites
      const favorite = await storage.addFavorite({
        userId,
        favoriteUserId,
        monthKey: currentMonthKey,
      });
      
      res.json({
        success: true,
        favorite: {
          id: favorite.id,
          favoriteUserId: favorite.favoriteUserId,
          favoriteUser: {
            id: favoriteUser.id,
            anonName: favoriteUser.anonName,
            gender: favoriteUser.gender,
          },
          createdAt: favorite.createdAt,
          monthKey: favorite.monthKey,
        },
        message: 'Пользователь добавлен в избранное! Выбирайте мудро - следующего можно добавить только в следующем месяце.',
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'add_favorite', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });

  // Remove user from favorites
  app.delete('/api/favorites/:userId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const favoriteUserId = parseInt(req.params.userId, 10);
      
      if (isNaN(favoriteUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      await storage.removeFavorite(userId, favoriteUserId);
      
      res.json({ success: true, message: 'Пользователь удален из избранного' });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'remove_favorite', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // Check if a specific user is in favorites
  app.get('/api/favorites/check/:userId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const favoriteUserId = parseInt(req.params.userId, 10);
      
      if (isNaN(favoriteUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const isFavorite = await storage.isFavorite(userId, favoriteUserId);
      
      res.json({ isFavorite });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'check_favorite', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to check favorite status' });
    }
  });

  // ============================================================================
  // NOTIFICATIONS / FRIEND REQUESTS ROUTES
  // ============================================================================

  // Get pending friend requests (notifications)
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const pendingRequests = await storage.getPendingRequestsForUser(userId);
      
      // Get current date info for frontend
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Calculate days until next month (when requests are sent)
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const daysUntilMonthEnd = lastDayOfMonth - currentDay;
      
      // Requests are sent on the 1st of each month
      const daysUntilUpdate = daysUntilMonthEnd + 1;
      
      res.json({
        notifications: pendingRequests.map(req => ({
          id: req.id,
          fromUserId: req.fromUserId,
          fromUser: {
            id: req.fromUser.id,
            anonName: req.fromUser.anonName,
            gender: req.fromUser.gender,
            course: req.fromUser.course,
            direction: req.fromUser.direction,
          },
          status: req.status,
          monthKey: req.monthKey,
          createdAt: req.createdAt,
        })),
        daysUntilUpdate,
        currentDate: now.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'get_notifications', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Respond to a friend request (accept/reject)
  app.post('/api/notifications/:requestId/respond', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const rawRequestId = req.params.requestId;
      const { action } = req.body; // 'accept' or 'reject'
      
      if (typeof rawRequestId !== 'string' || !/^[1-9]\d*$/.test(rawRequestId)) {
        return res.status(400).json({ error: 'Invalid request ID' });
      }

      const requestId = Number(rawRequestId);
      
      if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Use "accept" or "reject"' });
      }
      
      const status = action === 'accept' ? 'accepted' : 'rejected';
      const updatedRequest = await storage.respondToFriendRequest(requestId, userId, status);
      
      if (!updatedRequest) {
        return res.status(404).json({ error: 'Pending request not found' });
      }
      
      res.json({
        success: true,
        message: action === 'accept' 
          ? 'Заявка принята! Пользователь теперь может видеть ваш публичный профиль.' 
          : 'Заявка отклонена.',
        request: updatedRequest,
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'respond_notification', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to respond to notification' });
    }
  });

  // Get user's popularity (how many times they've been favorited this month)
  app.get('/api/popularity/:userId?', requireAuth, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId ? parseInt(req.params.userId, 10) : req.user.userId;
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const popularity = await storage.getUserPopularity(targetUserId, currentMonthKey);
      
      res.json({
        userId: targetUserId,
        popularity,
        monthKey: currentMonthKey,
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, { context: 'get_popularity', userId: req.user?.userId });
      }
      res.status(500).json({ error: 'Failed to get popularity' });
    }
  });

  return httpServer;
}
