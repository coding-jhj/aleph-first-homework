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

    const items = await query(
      `select id, title, content, created_at, sort_order
       from public.t08_private_items
       where account_id = $1
       order by sort_order asc, created_at asc`,
      [session.account_id]
    );

    sendJson(res, 200, {
      items: items || [],
      accountScope: 'session_account_only'
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
