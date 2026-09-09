import { getAccountById, publicAccount } from './_lib/accounts.js';
import { clearSessionCookie, findSession } from './_lib/session.js';
import { isHttpMethod, methodNotAllowed, sendError, sendJson, reportUnexpectedError } from './_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'GET')) {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    const session = await findSession(req);
    if (!session) {
      sendError(res, 401, '패스키 인증이 필요합니다.', 'authentication_required');
      return;
    }
    const account = await getAccountById(session.account_id);
    if (!account) {
      clearSessionCookie(res);
      sendError(res, 401, '세션의 계정을 찾을 수 없습니다.', 'account_not_found');
      return;
    }
    sendJson(res, 200, {
      authenticated: true,
      account: publicAccount(account),
      sessionExpiresAt: session.expires_at
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
