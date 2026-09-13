import { describe, expect, it } from 'vitest';
import { addCacheVersion, resolvePublicBaseUrl } from '../public-url';

describe('resolvePublicBaseUrl', () => {
  it('always prefers Render managed URL while running on Render', () => {
    expect(resolvePublicBaseUrl({
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://anonchatgate.onrender.com',
      WEBAPP_URL: 'https://expired-tunnel.example',
    })).toBe('https://anonchatgate.onrender.com');
  });

  it('uses WEBAPP_URL outside Render', () => {
    expect(resolvePublicBaseUrl({ WEBAPP_URL: 'https://staging.example/app/' }))
      .toBe('https://staging.example/app');
  });

  it('adds HTTPS for a platform hostname and removes stale query data', () => {
    expect(resolvePublicBaseUrl({ RAILWAY_PUBLIC_DOMAIN: 'app.example/?old=1#hash' }))
      .toBe('https://app.example');
  });

  it('rejects URLs containing credentials', () => {
    expect(() => resolvePublicBaseUrl({ WEBAPP_URL: 'https://user:pass@example.com' }))
      .toThrow('without credentials');
  });
});

describe('addCacheVersion', () => {
  it('adds a version query without changing the canonical origin', () => {
    expect(addCacheVersion('https://anonchatgate.onrender.com', 123))
      .toBe('https://anonchatgate.onrender.com/?v=123');
  });
});
