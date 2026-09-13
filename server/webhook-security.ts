import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const TELEGRAM_WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

export function isValidTelegramWebhookSecret(provided: unknown, expected: unknown): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) {
    return false;
  }

  const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * This middleware must be registered before express.json() so unauthenticated
 * webhook bodies are rejected without being parsed or processed.
 */
export function requireTelegramWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ error: 'Webhook is not configured' });
  }

  const providedSecret = req.get(TELEGRAM_WEBHOOK_SECRET_HEADER);
  if (!isValidTelegramWebhookSecret(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  return next();
}
