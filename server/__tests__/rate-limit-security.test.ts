import crypto from 'node:crypto';
import type { Request } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateTokenPair } from '../auth';
import {
  accessUserRateLimitKey,
  clientIpRateLimitKey,
  refreshUserRateLimitKey,
  resolveClientIp,
} from '../rate-limit-security';

function request(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    ip: '10.0.0.5',
    socket: { remoteAddress: '10.0.0.5' },
    ...overrides,
  } as Request;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'rate-limit-test-secret-at-least-32-characters';
});

describe('rate-limit identity', () => {
  it('uses Render trusted client IP and ignores X-Forwarded-For input', () => {
    const req = request({
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.99',
      },
    });

    expect(resolveClientIp(req, true)).toBe('203.0.113.10');
  });

  it('does not trust a Cloudflare header outside Render', () => {
    const req = request({
      headers: { 'cf-connecting-ip': '203.0.113.10' },
      ip: '127.0.0.1',
    });

    expect(resolveClientIp(req, false)).toBe('127.0.0.1');
  });

  it('isolates 100 authenticated users sharing one NAT address', () => {
    const keys = new Set<string>();

    for (let id = 1; id <= 100; id += 1) {
      const token = generateTokenPair(
        { id, anonName: `Student ${id}`, status: 'approved' },
        { sessionId: crypto.randomUUID() },
      ).token;
      keys.add(accessUserRateLimitKey(request({
        headers: { authorization: `Bearer ${token}` },
        ip: '192.0.2.50',
      })));
    }

    expect(keys.size).toBe(100);
  });

  it('groups unauthenticated traffic by normalized IP', () => {
    const first = clientIpRateLimitKey(request({ ip: '2001:db8:abcd:12::1' }));
    const second = clientIpRateLimitKey(request({ ip: '2001:db8:abcd:12::2' }));

    expect(first).toBe(second);
  });

  it('keys refresh requests by user and rejects an access token as refresh identity', () => {
    const pair = generateTokenPair(
      { id: 42, anonName: 'Student', status: 'approved' },
      { sessionId: crypto.randomUUID() },
    );
    const ipKey = clientIpRateLimitKey(request());

    expect(refreshUserRateLimitKey(request({ body: { refreshToken: pair.refreshToken } })))
      .toBe('user:42');
    expect(refreshUserRateLimitKey(request({ body: { refreshToken: pair.token } })))
      .toBe(ipKey);
  });
});
