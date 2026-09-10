import { query } from '../_lib/db.js';
import { requireSession } from '../_lib/session.js';
import { isHttpMethod, methodNotAllowed, sendJson, reportUnexpectedError } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'GET')) {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const events = await query(
      `select event_type, success, reason_code, challenge_fingerprint,
              credential_fingerprint, created_at
       from public.t08_auth_events
       where account_id = $1
       order by created_at desc
       limit 50`,
      [session.account_id]
    );

    sendJson(res, 200, {
      events: events || [],
      redaction: 'session tokens, signatures, and raw credential material are never returned'
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
