import jwt from 'jsonwebtoken';
import { logger, logAuth } from './logger';

interface TokenPayload {
  userId: number;
  anonName: string;
  status: string;
  iat: number;
}

interface AuthUser {
  id: number;
  anonName: string | null;
  status: string;
}

// Get the JWT secret with proper production validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  // Critical production check - fail fast if no secret in production
  if (process.env.NODE_ENV === 'production' && !secret) {
    logger.error('FATAL: JWT_SECRET is required in production environment');
    process.exit(1);
  }
  
  // Use dedicated JWT_SECRET or fallback for development only
  return secret || process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production';
}

export function generateAuthToken(user: AuthUser): string {
  const secret = getJwtSecret();
  
  const payload = {
    userId: user.id,
    anonName: user.anonName,
    status: user.status,
    iat: Math.floor(Date.now() / 1000),
  };
  
  logger.debug({ userId: user.id }, 'Generating auth token');
  
  // Short-lived tokens for WebSocket auth (15 minutes)
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function generateRefreshToken(user: AuthUser): string {
  const secret = getJwtSecret();
  
  const payload = {
    userId: user.id,
    anonName: user.anonName,
    status: user.status,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
  };
  
  logger.debug({ userId: user.id }, 'Generating refresh token');
  
  // Longer-lived refresh tokens (7 days)
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): { userId: number; anonName: string | null; status: string } | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    if (!decoded || !decoded.userId || !decoded.status) {
      logger.debug('Token verification failed: invalid token structure');
      return null;
    }
    
    logAuth('verify_token', decoded.userId, true);
    
    return {
      userId: decoded.userId,
      anonName: decoded.anonName,
      status: decoded.status
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.debug({ error: error.message }, 'Token verification failed');
    }
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: number; anonName: string; status: string } | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;
    
    if (!decoded || !decoded.userId || !decoded.status || decoded.type !== 'refresh') {
      logger.debug('Refresh token verification failed: invalid token structure');
      return null;
    }
    
    logAuth('verify_refresh_token', decoded.userId, true);
    
    return {
      userId: decoded.userId,
      anonName: decoded.anonName,
      status: decoded.status
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.debug({ error: error.message }, 'Refresh token verification failed');
    }
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const secret = getJwtSecret();
    jwt.verify(token, secret);
    return false;
  } catch (error: any) {
    return error.name === 'TokenExpiredError';
  }
}