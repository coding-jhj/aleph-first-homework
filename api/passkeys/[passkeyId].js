import { execute, query, queryOne } from '../_lib/db.js';
import { requireSession, revokeAllSessions, clearSessionCookie } from '../_lib/session.js';
import { queryValue } from '../_lib/route-utils.js';
import { recordSecurityEvent } from '../_lib/events.js';
import { isHttpMethod, methodNotAllowed, sendError, sendJson, reportUnexpectedError } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'DELETE')) {
    methodNotAllowed(res, ['DELETE']);
    return;
  }

  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const passkeyId = queryValue(req, 'passkeyId');
    const passkey = await queryOne(
      `select id, account_id, credential_id
       from public.t08_passkeys
       where id = $1
         and account_id = $2
       limit 1`,
      [passkeyId, session.account_id]
    );
    if (!passkey) {
      sendError(res, 404, '현재 계정에서 패스키를 찾을 수 없습니다.', 'passkey_not_found');
      return;
    }

    await execute(
      `delete from public.t08_passkeys
       where id = $1
         and account_id = $2`,
      [passkey.id, session.account_id]
    );

    const remaining = await query(
      `select id
       from public.t08_passkeys
       where account_id = $1`,
      [session.account_id]
    );

    const remainingCount = remaining?.length || 0;
    const sessionRevoked = remainingCount === 0;
    await recordSecurityEvent({
      accountId: session.account_id,
      credentialId: passkey.credential_id,
      eventType: 'passkey_deleted',
      success: true,
      reasonCode: sessionRevoked ? 'last_passkey_deleted' : 'passkey_deleted'
    });

    if (sessionRevoked) {
      await revokeAllSessions(session.account_id);
      clearSessionCookie(res);
    }

    sendJson(res, 200, {
      deleted: true,
      remaining: remainingCount,
      sessionRevoked
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
