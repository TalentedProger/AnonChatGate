type PublicUrlEnvironment = Record<string, string | undefined>;

/** Resolve the canonical externally reachable application URL. */
export function resolvePublicBaseUrl(
  environment: PublicUrlEnvironment = process.env,
): string | undefined {
  // RENDER_EXTERNAL_URL is injected and maintained by Render. Never let a
  // forgotten tunnel URL in WEBAPP_URL override it on that platform.
  const configured = environment.RENDER === 'true'
    ? environment.RENDER_EXTERNAL_URL
    : environment.WEBAPP_URL
      || environment.RAILWAY_PUBLIC_DOMAIN
      || environment.RENDER_EXTERNAL_URL
      || environment.REPLIT_DOMAINS?.split(',')[0];

  if (!configured?.trim()) return undefined;

  const candidate = /^https?:\/\//i.test(configured.trim())
    ? configured.trim()
    : `https://${configured.trim()}`;
  const url = new URL(candidate);

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Public application URL must be an HTTP(S) URL without credentials');
  }

  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');

  return url.toString().replace(/\/$/, '');
}

export function addCacheVersion(baseUrl: string, version = Date.now()): string {
  const url = new URL(baseUrl);
  url.searchParams.set('v', String(version));
  return url.toString();
}
