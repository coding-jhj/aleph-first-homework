import { deleteRows, fetchOne, fetchRows } from '../_lib/db.js';
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
    const passkey = await fetchOne(
      't08_passkeys',
      'id, account_id, credential_id',
      (query) => query.eq('id', passkeyId).eq('account_id', session.account_id).limit(1)
    );
    if (!passkey) {
      sendError(res, 404, '현재 계정에서 패스키를 찾을 수 없습니다.', 'passkey_not_found');
      return;
    }

    await deleteRows(
      't08_passkeys',
      (query) => query.eq('id', passkey.id).eq('account_id', session.account_id)
    );

    const remaining = await fetchRows(
      't08_passkeys',
      'id',
      (query) => query.eq('account_id', session.account_id)
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
