import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { AUTH } from './config';
import { logger, logAuth } from './logger';

const TOKEN_ISSUER = 'anonchatgate';
const TOKEN_AUDIENCE = 'anonchatgate-web';
const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';

interface AuthUser {
  id: number;
  anonName: string | null;
  status: string;
}

interface TokenPayload extends JwtPayload {
  userId: number;
  anonName: string | null;
  status: string;
  typ: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE;
  sid: string;
}

export interface VerifiedToken {
  userId: number;
  anonName: string | null;
  status: string;
  sessionId: string;
  tokenId: string;
  expiresAt: number;
}

export interface IssuedTokenPair {
  token: string;
  refreshToken: string;
  sessionId: string;
  refreshTokenId: string;
  refreshExpiresAt: Date;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    logger.fatal('JWT_SECRET with at least 32 characters is required in production');
    throw new Error('Invalid JWT_SECRET configuration');
  }

  return secret || process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production';
}

// Access and refresh JWTs use independent signing keys derived from the root secret.
// A token signed for one purpose therefore cannot validate as the other type.
function getSigningKey(purpose: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE): Buffer {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`anonchatgate:${purpose}:v1`)
    .digest();
}

function signToken(
  user: AuthUser,
  type: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE,
  sessionId: string,
  tokenId: string,
  expiresInSeconds: number,
): string {
  return jwt.sign(
    {
      userId: user.id,
      anonName: user.anonName,
      status: user.status,
      typ: type,
      sid: sessionId,
    },
    getSigningKey(type),
    {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      subject: String(user.id),
      jwtid: tokenId,
      expiresIn: expiresInSeconds,
    },
  );
}

export function generateAuthToken(
  user: AuthUser,
  sessionId: string,
  tokenId: string = crypto.randomUUID(),
): string {
  logger.debug({ userId: user.id, sessionId }, 'Generating access token');
  return signToken(
    user,
    ACCESS_TOKEN_TYPE,
    sessionId,
    tokenId,
    Math.floor(AUTH.ACCESS_TOKEN_LIFETIME_MS / 1000),
  );
}

export function generateRefreshToken(
  user: AuthUser,
  sessionId: string,
  tokenId: string = crypto.randomUUID(),
  expiresAtSeconds?: number,
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const defaultLifetime = Math.floor(AUTH.REFRESH_TOKEN_LIFETIME_MS / 1000);
  const expiresInSeconds = expiresAtSeconds
    ? Math.max(1, expiresAtSeconds - nowSeconds)
    : defaultLifetime;

  logger.debug({ userId: user.id, sessionId }, 'Generating refresh token');
  return signToken(user, REFRESH_TOKEN_TYPE, sessionId, tokenId, expiresInSeconds);
}

export function generateTokenPair(
  user: AuthUser,
  options: { sessionId?: string; refreshExpiresAtSeconds?: number } = {},
): IssuedTokenPair {
  const sessionId = options.sessionId || crypto.randomUUID();
  const refreshTokenId = crypto.randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const refreshExpiresAtSeconds = options.refreshExpiresAtSeconds
    || nowSeconds + Math.floor(AUTH.REFRESH_TOKEN_LIFETIME_MS / 1000);

  return {
    token: generateAuthToken(user, sessionId),
    refreshToken: generateRefreshToken(
      user,
      sessionId,
      refreshTokenId,
      refreshExpiresAtSeconds,
    ),
    sessionId,
    refreshTokenId,
    refreshExpiresAt: new Date(refreshExpiresAtSeconds * 1000),
  };
}

function verifyToken(
  token: string,
  expectedType: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE,
): VerifiedToken | null {
  try {
    const decoded = jwt.verify(token, getSigningKey(expectedType), {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    if (typeof decoded === 'string') {
      return null;
    }

    const payload = decoded as TokenPayload;
    if (
      payload.typ !== expectedType
      || !Number.isInteger(payload.userId)
      || payload.userId <= 0
      || payload.sub !== String(payload.userId)
      || !payload.status
      || !payload.sid
      || !payload.jti
      || !payload.exp
    ) {
      logger.debug({ expectedType }, 'Token verification failed: invalid claims');
      return null;
    }

    logAuth(expectedType === ACCESS_TOKEN_TYPE ? 'verify_token' : 'verify_refresh_token', payload.userId, true);

    return {
      userId: payload.userId,
      anonName: payload.anonName,
      status: payload.status,
      sessionId: payload.sid,
      tokenId: payload.jti,
      expiresAt: payload.exp,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.debug({ error: error.message, expectedType }, 'Token verification failed');
    }
    return null;
  }
}

export function verifyAuthToken(token: string): VerifiedToken | null {
  return verifyToken(token, ACCESS_TOKEN_TYPE);
}

export function verifyRefreshToken(token: string): VerifiedToken | null {
  return verifyToken(token, REFRESH_TOKEN_TYPE);
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token);
    return typeof decoded === 'string'
      || !decoded
      || typeof decoded.exp !== 'number'
      || decoded.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}
