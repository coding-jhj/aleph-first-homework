import { getConfig } from './config.js';
import { getDb } from './db.js';
import { fingerprint, newId } from './crypto.js';
import { setFlowCookie } from './session.js';

export async function storeChallenge(res, {
  kind,
  accountId = null,
  handle = null,
  challenge,
  metadata = {}
}) {
  const config = getConfig();
  const id = newId();
  const expiresAt = new Date(Date.now() + config.challengeTtlSeconds * 1000).toISOString();
  const row = {
    id,
    kind,
    account_id: accountId,
    handle,
    challenge,
    challenge_fingerprint: fingerprint(challenge),
    metadata,
    expires_at: expiresAt
  };
  const { error } = await getDb().from('t08_webauthn_challenges').insert(row);
  if (error) throw error;
  setFlowCookie(res, id);
  return { id, expiresAt, challengeFingerprint: row.challenge_fingerprint };
}

export async function peekChallenge(id) {
  if (!id) return null;
  const { data, error } = await getDb()
    .from('t08_webauthn_challenges')
    .select('id,kind,account_id,handle,challenge,challenge_fingerprint,metadata,expires_at,consumed_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function consumeChallenge(id, kind) {
  if (!id) return null;
  const now = new Date().toISOString();
  const { data, error } = await getDb()
    .from('t08_webauthn_challenges')
    .update({ consumed_at: now })
    .eq('id', id)
    .eq('kind', kind)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('id,kind,account_id,handle,challenge,challenge_fingerprint,metadata,expires_at,consumed_at')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
