const DEFAULT_ORIGIN = 'https://aleph-first-homework.vercel.app';

function positiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function getConfig() {
  const configuredOrigin = process.env.PUBLIC_ORIGIN || DEFAULT_ORIGIN;
  const originUrl = new URL(configuredOrigin);
  const isLocal = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
  if (originUrl.protocol !== 'https:' && !isLocal) {
    throw new Error('PUBLIC_ORIGIN_must_use_https');
  }

  const rpId = process.env.WEBAUTHN_RP_ID || originUrl.hostname;
  if (!/^[a-z0-9.-]+$/i.test(rpId)) {
    throw new Error('invalid_webauthn_rp_id');
  }

  return {
    publicOrigin: originUrl.origin,
    rpId,
    rpName: process.env.WEBAUTHN_RP_NAME || 'AI Engineer Portfolio private space',
    challengeTtlSeconds: positiveInteger(process.env.WEBAUTHN_CHALLENGE_TTL_SECONDS, 300, 900),
    sessionTtlSeconds: positiveInteger(process.env.SESSION_TTL_SECONDS, 28800, 86400),
    cookieSecure: originUrl.protocol === 'https:'
  };
}
