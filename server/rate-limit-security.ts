import net from 'node:net';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { verifyAuthToken, verifyRefreshToken } from './auth';

type RateLimitRequest = Pick<Request, 'body' | 'headers' | 'ip' | 'socket'>;

function validIp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return net.isIP(trimmed) ? trimmed : undefined;
}

/**
 * Render places the app behind Cloudflare and sets RENDER=true. On that
 * platform CF-Connecting-IP is overwritten at the edge and identifies the
 * caller without trusting a client-controlled X-Forwarded-For chain.
 */
export function resolveClientIp(
  req: RateLimitRequest,
  isRender = process.env.RENDER === 'true',
): string {
  if (isRender) {
    const cloudflareIp = validIp(req.headers['cf-connecting-ip']);
    if (cloudflareIp) return cloudflareIp;
  }

  return validIp(req.ip)
    ?? validIp(req.socket.remoteAddress)
    ?? 'unknown-client';
}

export function clientIpRateLimitKey(req: RateLimitRequest): string {
  const address = resolveClientIp(req);
  return address === 'unknown-client'
    ? 'ip:unknown-client'
    : `ip:${ipKeyGenerator(address, 56)}`;
}

function bearerToken(req: RateLimitRequest): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string') return undefined;

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1];
}

export function accessUserRateLimitKey(req: RateLimitRequest): string {
  const token = bearerToken(req);
  const verified = token ? verifyAuthToken(token, { logSuccess: false }) : null;

  return verified
    ? `user:${verified.userId}`
    : clientIpRateLimitKey(req);
}

export function refreshUserRateLimitKey(req: RateLimitRequest): string {
  const refreshToken = typeof req.body?.refreshToken === 'string'
    ? req.body.refreshToken
    : undefined;
  const verified = refreshToken
    ? verifyRefreshToken(refreshToken, { logSuccess: false })
    : null;

  return verified
    ? `user:${verified.userId}`
    : clientIpRateLimitKey(req);
}
