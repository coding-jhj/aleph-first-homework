import { getDb } from '../_lib/db.js';
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
      const { error } = await getDb()
        .from('t08_webauthn_challenges')
        .delete()
        .eq('id', flowId)
        .eq('kind', 'registration')
        .is('consumed_at', null);
      if (error) throw error;
    }
    clearFlowCookie(res);
    sendNoContent(res);
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
