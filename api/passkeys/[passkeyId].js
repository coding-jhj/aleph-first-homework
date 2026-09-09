import { getDb } from '../_lib/db.js';
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
    const { data: passkey, error: lookupError } = await getDb()
      .from('t08_passkeys')
      .select('id,account_id,credential_id')
      .eq('id', passkeyId)
      .eq('account_id', session.account_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!passkey) {
      sendError(res, 404, '현재 계정에서 패스키를 찾을 수 없습니다.', 'passkey_not_found');
      return;
    }

    const { error: deleteError } = await getDb()
      .from('t08_passkeys')
      .delete()
      .eq('id', passkey.id)
      .eq('account_id', session.account_id);
    if (deleteError) throw deleteError;

    const { data: remaining, error: remainingError } = await getDb()
      .from('t08_passkeys')
      .select('id')
      .eq('account_id', session.account_id);
    if (remainingError) throw remainingError;

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
