import { getConfig } from './config.js';
import { execute, queryOne } from './db.js';
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

  const session = await queryOne(
    `select id, account_id, token_hash, expires_at, created_at
     from public.t08_sessions
     where token_hash = $1
       and revoked_at is null
       and expires_at > $2
     limit 1`,
    [sha256Hex(rawToken), new Date().toISOString()]
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
  const data = await queryOne(
    `insert into public.t08_sessions (account_id, token_hash, expires_at)
     values ($1, $2, $3)
     returning id, account_id, expires_at`,
    [accountId, sha256Hex(rawToken), expiresAt]
  );

  setCookie(res, SESSION_COOKIE, rawToken, cookieOptions(config, config.sessionTtlSeconds));
  return data;
}

export async function revokeSession(req) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) return;
  await execute(
    `update public.t08_sessions
     set revoked_at = $1
     where token_hash = $2
       and revoked_at is null`,
    [new Date().toISOString(), sha256Hex(rawToken)]
  );
}

export async function revokeAllSessions(accountId) {
  await execute(
    `update public.t08_sessions
     set revoked_at = $1
     where account_id = $2
       and revoked_at is null`,
    [new Date().toISOString(), accountId]
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
