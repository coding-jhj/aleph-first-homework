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

    const { data: items, error } = await getDb()
      .from('t08_private_items')
      .select('id,title,content,created_at,sort_order')
      .eq('account_id', session.account_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;

    sendJson(res, 200, {
      items: items || [],
      accountScope: 'session_account_only'
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
