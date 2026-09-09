import { query } from '../../../_lib/db.js';
import { requireSession } from '../../../_lib/session.js';
import { queryValue } from '../../../_lib/route-utils.js';
import { recordSecurityEvent } from '../../../_lib/events.js';
import { isHttpMethod, methodNotAllowed, sendError, sendJson, reportUnexpectedError } from '../../../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'GET')) {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const requestedAccountId = queryValue(req, 'accountId');
    if (!requestedAccountId || requestedAccountId !== session.account_id) {
      await recordSecurityEvent({
        accountId: session.account_id,
        eventType: 'authorization_denied',
        success: false,
        reasonCode: 'account_scope_mismatch'
      });
      sendError(res, 403, '현재 세션의 계정 자료만 조회할 수 있습니다.', 'account_scope_mismatch');
      return;
    }

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
