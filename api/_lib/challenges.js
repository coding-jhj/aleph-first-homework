import { getConfig } from './config.js';
import { jsonParam, query, queryOne } from './db.js';
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
  await query(
    `insert into public.t08_webauthn_challenges
      (id, kind, account_id, handle, challenge, challenge_fingerprint, metadata, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [id, kind, accountId, handle, challenge, challengeFingerprint, jsonParam(metadata), expiresAt]
  );
  setFlowCookie(res, id);
  return { id, expiresAt, challengeFingerprint };
}

export async function peekChallenge(id) {
  if (!id) return null;
  return queryOne(
    `select id, kind, account_id, handle, challenge, challenge_fingerprint,
            metadata, expires_at, consumed_at
     from public.t08_webauthn_challenges
     where id = $1
     limit 1`,
    [id]
  );
}

export async function consumeChallenge(id, kind) {
  if (!id) return null;
  const now = new Date().toISOString();
  return queryOne(
    `update public.t08_webauthn_challenges
     set consumed_at = $1
     where id = $2
       and kind = $3
       and consumed_at is null
       and expires_at > $1
     returning id, kind, account_id, handle, challenge, challenge_fingerprint,
               metadata, expires_at, consumed_at`,
    [now, id, kind]
  );
}
