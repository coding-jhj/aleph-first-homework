import { getDb } from '../_lib/db.js';
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

    const { data: events, error } = await getDb()
      .from('t08_auth_events')
      .select('event_type,success,reason_code,challenge_fingerprint,credential_fingerprint,created_at')
      .eq('account_id', session.account_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    sendJson(res, 200, {
      events: events || [],
      redaction: 'session tokens, signatures, and raw credential material are never returned'
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
