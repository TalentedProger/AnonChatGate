import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { isValidTelegramWebhookSecret, requireTelegramWebhookSecret } from '../webhook-security';

const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalSecret === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  } else {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
  }
});

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('Telegram webhook secret validation', () => {
  it('accepts the exact configured secret', () => {
    expect(isValidTelegramWebhookSecret('safe-secret', 'safe-secret')).toBe(true);
  });

  it.each([
    ['wrong-secret', 'safe-secret'],
    ['short', 'a-much-longer-secret'],
    [undefined, 'safe-secret'],
    ['safe-secret', undefined],
  ])('rejects mismatched or missing values', (provided, expected) => {
    expect(isValidTelegramWebhookSecret(provided, expected)).toBe(false);
  });

  it('rejects requests when the server secret is missing', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const request = { get: vi.fn() } as unknown as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireTelegramWebhookSecret(request, response, next);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid header without calling the next middleware', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'configured-secret';
    const request = { get: vi.fn().mockReturnValue('attacker-secret') } as unknown as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireTelegramWebhookSecret(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a valid header to reach body parsing and the route', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'configured-secret';
    const request = { get: vi.fn().mockReturnValue('configured-secret') } as unknown as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireTelegramWebhookSecret(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
