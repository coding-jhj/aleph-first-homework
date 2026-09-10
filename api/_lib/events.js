import { execute } from './db.js';
import { fingerprint } from './crypto.js';

export async function recordSecurityEvent({
  accountId = null,
  credentialId = null,
  eventType,
  success,
  reasonCode,
  challengeFingerprint = null
}) {
  try {
    await execute(
      `insert into public.t08_auth_events
        (account_id, credential_fingerprint, event_type, success, reason_code, challenge_fingerprint)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        accountId,
        credentialId ? fingerprint(credentialId) : null,
        eventType,
        Boolean(success),
        reasonCode,
        challengeFingerprint
      ]
    );
  } catch {
    console.error('[t08]', 'security_event_record_failed');
  }
}
