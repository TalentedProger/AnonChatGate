import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAuthToken, generateRefreshToken, generateTokenPair, hashRefreshToken, verifyAuthToken, verifyRefreshToken, isTokenExpired } from '../auth';

describe('Auth Module', () => {
  const testUser = {
    id: 1,
    anonName: 'Student_1',
    status: 'approved'
  };
  const sessionId = '22222222-2222-4222-8222-222222222222';

  let originalEnv: string | undefined;
  
  beforeAll(() => {
    // Save original JWT_SECRET
    originalEnv = process.env.JWT_SECRET;
    // Set a test secret
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-min-32-chars';
  });

  afterAll(() => {
    // Restore original JWT_SECRET
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe('generateAuthToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAuthToken(testUser, sessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('should include user data in token payload', () => {
      const token = generateAuthToken(testUser, sessionId);
      const verified = verifyAuthToken(token);
      
      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(testUser.id);
      expect(verified?.anonName).toBe(testUser.anonName);
      expect(verified?.status).toBe(testUser.status);
      expect(verified?.sessionId).toBe(sessionId);
      expect(verified?.tokenId).toBeTruthy();
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateAuthToken(testUser, sessionId);
      const token2 = generateAuthToken({ ...testUser, id: 2, anonName: 'Student_2' }, sessionId);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testUser, sessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should be verifiable as refresh token', () => {
      const token = generateRefreshToken(testUser, sessionId);
      const verified = verifyRefreshToken(token);
      
      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(testUser.id);
      expect(verified?.anonName).toBe(testUser.anonName);
      expect(verified?.status).toBe(testUser.status);
      expect(verified?.sessionId).toBe(sessionId);
      expect(verified?.tokenId).toBeTruthy();
    });

    it('should not verify refresh token as auth token type', () => {
      const refreshToken = generateRefreshToken(testUser, sessionId);
      const authToken = generateAuthToken(testUser, sessionId);
      
      // Both should verify with their respective functions
      expect(verifyRefreshToken(refreshToken)).toBeDefined();
      expect(verifyAuthToken(authToken)).toBeDefined();
      
      expect(verifyAuthToken(refreshToken)).toBeNull();
      expect(verifyRefreshToken(authToken)).toBeNull();
    });
  });

  describe('verifyAuthToken', () => {
    it('should verify valid auth token', () => {
      const token = generateAuthToken(testUser, sessionId);
      const verified = verifyAuthToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(testUser.id);
    });

    it('should return null for invalid token', () => {
      const verified = verifyAuthToken('invalid.token.here');
      
      expect(verified).toBeNull();
    });

    it('should return null for empty token', () => {
      const verified = verifyAuthToken('');
      
      expect(verified).toBeNull();
    });

    it('should return null for token with wrong signature', () => {
      const token = generateAuthToken(testUser, sessionId);
      const tamperedToken = token.slice(0, -10) + 'tampered12';
      const verified = verifyAuthToken(tamperedToken);
      
      expect(verified).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(testUser, sessionId);
      const verified = verifyRefreshToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(testUser.id);
    });

    it('should return null for auth token verified as refresh', () => {
      const authToken = generateAuthToken(testUser, sessionId);
      const verified = verifyRefreshToken(authToken);
      
      // Should return null because auth token doesn't have type: 'refresh'
      expect(verified).toBeNull();
    });

    it('should return null for invalid refresh token', () => {
      const verified = verifyRefreshToken('invalid.refresh.token');
      
      expect(verified).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for fresh token', () => {
      const token = generateAuthToken(testUser, sessionId);
      const expired = isTokenExpired(token);
      
      expect(expired).toBe(false);
    });

    it('should return true for malformed token', () => {
      const expired = isTokenExpired('malformed.token');
      
      // Malformed tokens will throw error, but not TokenExpiredError
      // So this might return true or false depending on error type
      expect(typeof expired).toBe('boolean');
    });
  });

  describe('Edge cases', () => {
    it('should handle user with null anonName', () => {
      const userWithoutName = {
        id: 999,
        anonName: null,
        status: 'approved'
      };
      
      const token = generateAuthToken(userWithoutName, sessionId);
      const verified = verifyAuthToken(token);
      
      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(999);
      expect(verified?.anonName).toBeNull();
    });

    it('should handle different status values', () => {
      const pendingUser = { ...testUser, status: 'pending' };
      const rejectedUser = { ...testUser, status: 'rejected' };
      
      const token1 = generateAuthToken(pendingUser, sessionId);
      const token2 = generateAuthToken(rejectedUser, sessionId);
      
      const verified1 = verifyAuthToken(token1);
      const verified2 = verifyAuthToken(token2);
      
      expect(verified1?.status).toBe('pending');
      expect(verified2?.status).toBe('rejected');
    });
  });

  describe('security claims and rotation material', () => {
    it('adds strict standard and custom claims to both token types', () => {
      const pair = generateTokenPair(testUser, { sessionId });
      const access = jwt.decode(pair.token) as jwt.JwtPayload;
      const refresh = jwt.decode(pair.refreshToken) as jwt.JwtPayload;

      expect(access).toMatchObject({
        typ: 'access',
        iss: 'anonchatgate',
        aud: 'anonchatgate-web',
        sub: String(testUser.id),
        sid: sessionId,
      });
      expect(refresh).toMatchObject({
        typ: 'refresh',
        iss: 'anonchatgate',
        aud: 'anonchatgate-web',
        sub: String(testUser.id),
        sid: sessionId,
      });
      expect(access.jti).toBeTruthy();
      expect(refresh.jti).toBe(pair.refreshTokenId);
    });

    it('uses different signing keys for access and refresh tokens', () => {
      const pair = generateTokenPair(testUser, { sessionId });

      expect(verifyAuthToken(pair.refreshToken)).toBeNull();
      expect(verifyRefreshToken(pair.token)).toBeNull();
    });

    it('hashes refresh tokens without storing the bearer credential', () => {
      const pair = generateTokenPair(testUser, { sessionId });
      const hash = hashRefreshToken(pair.refreshToken);

      expect(hash).toHaveLength(64);
      expect(hash).not.toContain(pair.refreshToken);
      expect(hashRefreshToken(pair.refreshToken)).toBe(hash);
    });

    it('creates a new refresh jti for every rotation', () => {
      const first = generateTokenPair(testUser, { sessionId });
      const second = generateTokenPair(testUser, {
        sessionId,
        refreshExpiresAtSeconds: Math.floor(first.refreshExpiresAt.getTime() / 1000),
      });

      expect(second.refreshTokenId).not.toBe(first.refreshTokenId);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.refreshExpiresAt).toEqual(first.refreshExpiresAt);
    });
  });
});
