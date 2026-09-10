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

    const passkeys = await query(
      `select id, nickname, created_at, device_type, backed_up
       from public.t08_passkeys
       where account_id = $1
       order by created_at asc`,
      [session.account_id]
    );

    sendJson(res, 200, { passkeys: passkeys || [] });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
