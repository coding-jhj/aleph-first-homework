import { recordSecurityEvent } from '../_lib/events.js';
import { clearFlowCookie, clearSessionCookie, findSession, revokeSession } from '../_lib/session.js';
import { isHttpMethod, methodNotAllowed, sendNoContent, reportUnexpectedError } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const session = await findSession(req);
    if (session) {
      await recordSecurityEvent({
        accountId: session.account_id,
        eventType: 'logout',
        success: true,
        reasonCode: 'explicit_logout'
      });
      await revokeSession(req);
    }
    clearSessionCookie(res);
    clearFlowCookie(res);
    sendNoContent(res);
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
