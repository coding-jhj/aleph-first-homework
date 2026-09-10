import { getConfig } from '../_lib/config.js';
import { fetchOne, updateRows } from '../_lib/db.js';
import { getAccountById, publicAccount } from '../_lib/accounts.js';
import { getFlowId, clearFlowCookie, createSession } from '../_lib/session.js';
import { consumeChallenge, peekChallenge } from '../_lib/challenges.js';
import { verifyAuthentication } from '../_lib/webauthn.js';
import { recordSecurityEvent } from '../_lib/events.js';
import { isHttpMethod, methodNotAllowed, readJson, sendError, sendJson, reportUnexpectedError } from '../_lib/http.js';

async function recordFailure(accountId, credentialId, eventType, reasonCode, challengeFingerprint) {
  await recordSecurityEvent({
    accountId,
    credentialId,
    eventType,
    success: false,
    reasonCode,
    challengeFingerprint
  });
}

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const body = await readJson(req);
    const response = body.response;
    const credentialId = typeof response?.id === 'string' ? response.id : '';
    if (!response || typeof response !== 'object' || !credentialId) {
      sendError(res, 400, '인증 assertion 응답이 필요합니다.', 'authentication_response_required');
      return;
    }

    const flowId = getFlowId(req);
    const previousChallenge = await peekChallenge(flowId);
    const challenge = await consumeChallenge(flowId, 'authentication');
    if (!challenge) {
      await recordFailure(
        previousChallenge?.account_id || null,
        credentialId,
        'challenge_rejected',
        'challenge_replay_or_expired',
        previousChallenge?.challenge_fingerprint || null
      );
      clearFlowCookie(res);
      sendError(res, 401, '로그인 challenge가 만료되었거나 이미 사용되었습니다.', 'challenge_rejected');
      return;
    }

    const passkey = await fetchOne(
      't08_passkeys',
      'id, account_id, credential_id, public_key, counter, transports',
      (query) => query.eq('credential_id', credentialId).limit(1)
    );

    if (!passkey) {
      await recordFailure(
        challenge.account_id,
        credentialId,
        'authentication_failed',
        'credential_not_registered',
        challenge.challenge_fingerprint
      );
      clearFlowCookie(res);
      sendError(res, 401, '등록되지 않은 패스키입니다.', 'credential_not_registered');
      return;
    }

    if (passkey.account_id !== challenge.account_id) {
      await recordFailure(
        challenge.account_id,
        credentialId,
        'authorization_denied',
        'credential_account_mismatch',
        challenge.challenge_fingerprint
      );
      clearFlowCookie(res);
      sendError(res, 403, '요청한 계정과 패스키의 소유자가 다릅니다.', 'credential_account_mismatch');
      return;
    }

    let verification;
    try {
      verification = await verifyAuthentication(
        getConfig(),
        response,
        challenge.challenge,
        passkey
      );
    } catch {
      await recordFailure(
        challenge.account_id,
        credentialId,
        'authentication_failed',
        'signature_or_origin_verification_failed',
        challenge.challenge_fingerprint
      );
      clearFlowCookie(res);
      sendError(res, 401, '패스키 서명 또는 challenge 검증에 실패했습니다.', 'signature_verification_failed');
      return;
    }

    if (!verification.verified) {
      await recordFailure(
        challenge.account_id,
        credentialId,
        'authentication_failed',
        'signature_not_verified',
        challenge.challenge_fingerprint
      );
      clearFlowCookie(res);
      sendError(res, 401, '패스키 인증이 승인되지 않았습니다.', 'signature_not_verified');
      return;
    }

    const newCounter = Number(verification.authenticationInfo.newCounter);
    await updateRows(
      't08_passkeys',
      { counter: Math.max(Number(passkey.counter), newCounter) },
      (query) => query.eq('id', passkey.id).eq('account_id', challenge.account_id)
    );

    const account = await getAccountById(challenge.account_id);
    if (!account) {
      clearFlowCookie(res);
      sendError(res, 401, '인증 계정을 찾을 수 없습니다.', 'account_not_found');
      return;
    }

    clearFlowCookie(res);
    const session = await createSession(res, account.id);
    await recordSecurityEvent({
      accountId: account.id,
      credentialId,
      eventType: 'authentication_verified',
      success: true,
      reasonCode: 'authentication_verified',
      challengeFingerprint: challenge.challenge_fingerprint
    });

    sendJson(res, 200, {
      message: '패스키 인증이 완료되었습니다.',
      account: publicAccount(account),
      sessionExpiresAt: session.expires_at,
      challengeFingerprint: challenge.challenge_fingerprint
    });
  } catch (error) {
    clearFlowCookie(res);
    reportUnexpectedError(res, error);
  }
}
