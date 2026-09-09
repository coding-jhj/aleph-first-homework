import { getDb } from './db.js';
import { fingerprint } from './crypto.js';

export async function recordSecurityEvent({
  accountId = null,
  credentialId = null,
  eventType,
  success,
  reasonCode,
  challengeFingerprint = null
}) {
  const { error } = await getDb().from('t08_auth_events').insert({
    account_id: accountId,
    credential_fingerprint: credentialId ? fingerprint(credentialId) : null,
    event_type: eventType,
    success: Boolean(success),
    reason_code: reasonCode,
    challenge_fingerprint: challengeFingerprint
  });
  if (error) {
    console.error('[t08]', 'security_event_record_failed');
  }
}
