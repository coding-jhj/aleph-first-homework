import { getConfig } from './config.js';
import { fetchOne, insertRows, updateOne } from './db.js';
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
  const challengeFingerprint = fingerprint(challenge);
  await insertRows('t08_webauthn_challenges', {
    id,
    kind,
    account_id: accountId,
    handle,
    challenge,
    challenge_fingerprint: challengeFingerprint,
    metadata: metadata || {},
    expires_at: expiresAt
  });
  setFlowCookie(res, id);
  return { id, expiresAt, challengeFingerprint };
}

export async function peekChallenge(id) {
  if (!id) return null;
  return fetchOne(
    't08_webauthn_challenges',
    'id, kind, account_id, handle, challenge, challenge_fingerprint, metadata, expires_at, consumed_at',
    (query) => query.eq('id', id).limit(1)
  );
}

export async function consumeChallenge(id, kind) {
  if (!id) return null;
  const now = new Date().toISOString();
  return updateOne(
    't08_webauthn_challenges',
    { consumed_at: now },
    (query) => query
      .eq('id', id)
      .eq('kind', kind)
      .is('consumed_at', null)
      .gt('expires_at', now),
    'id, kind, account_id, handle, challenge, challenge_fingerprint, metadata, expires_at, consumed_at'
  );
}
