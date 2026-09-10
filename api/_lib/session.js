import { getConfig } from './config.js';
import { fetchOne, updateRows, insertOne } from './db.js';
import { newBase64UrlToken, sha256Hex } from './crypto.js';
import { clearCookie, readCookie, setCookie } from './cookies.js';
import { sendJson } from './http.js';

export const SESSION_COOKIE = 't08_session';
export const FLOW_COOKIE = 't08_webauthn_flow';

function cookieOptions(config, maxAge) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge
  };
}

export async function findSession(req) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) return null;

  const now = new Date().toISOString();
  const session = await fetchOne(
    't08_sessions',
    'id, account_id, token_hash, expires_at, created_at',
    (query) => query
      .eq('token_hash', sha256Hex(rawToken))
      .is('revoked_at', null)
      .gt('expires_at', now)
      .limit(1)
  );
  return session ? { ...session, rawToken } : null;
}

export async function requireSession(req, res) {
  const session = await findSession(req);
  if (!session) {
    sendJson(res, 401, {
      error: '패스키 인증이 필요합니다.',
      code: 'authentication_required'
    });
    return null;
  }
  return session;
}

export async function createSession(res, accountId) {
  const config = getConfig();
  const rawToken = newBase64UrlToken(32);
  const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString();
  const data = await insertOne('t08_sessions', {
    account_id: accountId,
    token_hash: sha256Hex(rawToken),
    expires_at: expiresAt
  }, 'id, account_id, expires_at');

  setCookie(res, SESSION_COOKIE, rawToken, cookieOptions(config, config.sessionTtlSeconds));
  return data;
}

export async function revokeSession(req) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) return;
  await updateRows(
    't08_sessions',
    { revoked_at: new Date().toISOString() },
    (query) => query.eq('token_hash', sha256Hex(rawToken)).is('revoked_at', null)
  );
}

export async function revokeAllSessions(accountId) {
  await updateRows(
    't08_sessions',
    { revoked_at: new Date().toISOString() },
    (query) => query.eq('account_id', accountId).is('revoked_at', null)
  );
}

export function setFlowCookie(res, flowId) {
  const config = getConfig();
  setCookie(res, FLOW_COOKIE, flowId, cookieOptions(config, config.challengeTtlSeconds));
}

export function clearFlowCookie(res) {
  const config = getConfig();
  clearCookie(res, FLOW_COOKIE, cookieOptions(config, 0));
}

export function clearSessionCookie(res) {
  const config = getConfig();
  clearCookie(res, SESSION_COOKIE, cookieOptions(config, 0));
}

export function getFlowId(req) {
  return readCookie(req, FLOW_COOKIE);
}
