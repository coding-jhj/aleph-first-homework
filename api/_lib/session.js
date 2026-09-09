import { getConfig } from './config.js';
import { getDb } from './db.js';
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

  const { data, error } = await getDb()
    .from('t08_sessions')
    .select('id,account_id,token_hash,expires_at,created_at')
    .eq('token_hash', sha256Hex(rawToken))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, rawToken } : null;
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
  const { data, error } = await getDb()
    .from('t08_sessions')
    .insert({
      account_id: accountId,
      token_hash: sha256Hex(rawToken),
      expires_at: expiresAt
    })
    .select('id,account_id,expires_at')
    .single();
  if (error) throw error;

  setCookie(res, SESSION_COOKIE, rawToken, cookieOptions(config, config.sessionTtlSeconds));
  return data;
}

export async function revokeSession(req) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) return;
  const { error } = await getDb()
    .from('t08_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', sha256Hex(rawToken))
    .is('revoked_at', null);
  if (error) throw error;
}

export async function revokeAllSessions(accountId) {
  const { error } = await getDb()
    .from('t08_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .is('revoked_at', null);
  if (error) throw error;
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
