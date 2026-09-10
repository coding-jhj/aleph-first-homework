import { execute } from '../_lib/db.js';
import { clearFlowCookie, getFlowId } from '../_lib/session.js';
import { isHttpMethod, methodNotAllowed, sendJson, sendNoContent, reportUnexpectedError } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const flowId = getFlowId(req);
    if (flowId) {
      await execute(
        `delete from public.t08_webauthn_challenges
         where id = $1
           and kind = $2
           and consumed_at is null`,
        [flowId, 'registration']
      );
    }
    clearFlowCookie(res);
    sendNoContent(res);
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
