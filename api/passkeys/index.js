import { fetchRows } from '../_lib/db.js';
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

    const passkeys = await fetchRows(
      't08_passkeys',
      'id, nickname, created_at, device_type, backed_up',
      (query) => query.eq('account_id', session.account_id).order('created_at', { ascending: true })
    );

    sendJson(res, 200, { passkeys: passkeys || [] });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
