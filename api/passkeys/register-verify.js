import { getConfig } from '../_lib/config.js';
import { getDb } from '../_lib/db.js';
import { getAccountById, publicAccount } from '../_lib/accounts.js';
import { getFlowId, findSession, clearFlowCookie, createSession } from '../_lib/session.js';
import { consumeChallenge, peekChallenge } from '../_lib/challenges.js';
import { registrationToRow, verifyRegistration } from '../_lib/webauthn.js';
import { recordSecurityEvent } from '../_lib/events.js';
import { syntheticPrivateItems } from '../_lib/seed.js';
import { isHttpMethod, methodNotAllowed, readJson, sendError, sendJson, reportUnexpectedError } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  let challenge = null;
  try {
    const body = await readJson(req);
    if (!body.response || typeof body.response !== 'object') {
      sendError(res, 400, '등록 credential 응답이 필요합니다.', 'registration_response_required');
      return;
    }

    const flowId = getFlowId(req);
    const beforeConsume = await peekChallenge(flowId);
    challenge = await consumeChallenge(flowId, 'registration');
    if (!challenge) {
      clearFlowCookie(res);
      sendError(res, 401, '등록 요청이 만료되었거나 이미 처리되었습니다.', 'registration_challenge_rejected');
      return;
    }

    const config = getConfig();
    const session = await findSession(req);
    if (challenge.account_id && (!session || session.account_id !== challenge.account_id)) {
      await recordSecurityEvent({
        accountId: challenge.account_id,
        eventType: 'registration_failed',
        success: false,
        reasonCode: 'session_scope_mismatch',
        challengeFingerprint: challenge.challenge_fingerprint
      });
      clearFlowCookie(res);
      sendError(res, 401, '현재 세션과 등록 요청의 계정이 다릅니다.', 'registration_scope_mismatch');
      return;
    }

    let verification;
    try {
      verification = await verifyRegistration(config, body.response, challenge.challenge);
    } catch {
      await recordSecurityEvent({
        accountId: challenge.account_id,
        eventType: 'registration_failed',
        success: false,
        reasonCode: 'attestation_verification_failed',
        challengeFingerprint: challenge.challenge_fingerprint
      });
      clearFlowCookie(res);
      sendError(res, 401, '패스키 등록 검증에 실패했습니다.', 'registration_verification_failed');
      return;
    }

    if (!verification.verified) {
      await recordSecurityEvent({
        accountId: challenge.account_id,
        eventType: 'registration_failed',
        success: false,
        reasonCode: 'attestation_not_verified',
        challengeFingerprint: challenge.challenge_fingerprint
      });
      clearFlowCookie(res);
      sendError(res, 401, '패스키 등록이 승인되지 않았습니다.', 'registration_not_verified');
      return;
    }

    const credential = registrationToRow(verification);
    const { data: existingCredential, error: lookupError } = await getDb()
      .from('t08_passkeys')
      .select('id')
      .eq('credential_id', credential.credential_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existingCredential) {
      await recordSecurityEvent({
        accountId: challenge.account_id,
        credentialId: credential.credential_id,
        eventType: 'registration_failed',
        success: false,
        reasonCode: 'credential_already_registered',
        challengeFingerprint: challenge.challenge_fingerprint
      });
      clearFlowCookie(res);
      sendError(res, 409, '이미 등록된 패스키입니다.', 'credential_already_registered');
      return;
    }

    let account;
    let createdAccountId = null;
    try {
      if (challenge.account_id) {
        account = await getAccountById(challenge.account_id);
        if (!account) {
          clearFlowCookie(res);
          sendError(res, 401, '등록 대상 계정을 찾을 수 없습니다.', 'account_not_found');
          return;
        }
      } else {
        const metadata = challenge.metadata || {};
        const { data: createdAccount, error: accountError } = await getDb()
          .from('t08_accounts')
          .insert({
            handle: String(metadata.handle || challenge.handle || '').toLowerCase(),
            display_name: String(metadata.displayName || metadata.handle || challenge.handle || 'Synthetic account'),
            webauthn_user_id: String(metadata.webauthnUserId || '')
          })
          .select('id,handle,display_name,webauthn_user_id,created_at')
          .single();
        if (accountError) throw accountError;
        account = createdAccount;
        createdAccountId = account.id;
      }

      const { error: passkeyError } = await getDb()
        .from('t08_passkeys')
        .insert({
          account_id: account.id,
          credential_id: credential.credential_id,
          public_key: credential.public_key,
          counter: credential.counter,
          transports: credential.transports,
          device_type: credential.device_type,
          backed_up: credential.backed_up,
          nickname: String((challenge.metadata || {}).nickname || '주 사용 기기')
        });
      if (passkeyError) throw passkeyError;

      if (createdAccountId) {
        const { error: itemError } = await getDb()
          .from('t08_private_items')
          .insert(syntheticPrivateItems(account.handle).map((item) => ({
            account_id: account.id,
            title: item.title,
            content: item.content,
            sort_order: item.sort_order
          })));
        if (itemError) throw itemError;
      }
    } catch (error) {
      if (createdAccountId) {
        await getDb().from('t08_private_items').delete().eq('account_id', createdAccountId);
        await getDb().from('t08_passkeys').delete().eq('account_id', createdAccountId);
        await getDb().from('t08_accounts').delete().eq('id', createdAccountId);
      }
      if (error?.code === '23505') {
        clearFlowCookie(res);
        sendError(res, 409, '공개 별칭 또는 패스키가 이미 사용 중입니다.', 'duplicate_registration');
        return;
      }
      throw error;
    }

    await recordSecurityEvent({
      accountId: account.id,
      credentialId: credential.credential_id,
      eventType: 'registration_verified',
      success: true,
      reasonCode: 'registration_verified',
      challengeFingerprint: challenge.challenge_fingerprint
    });
    clearFlowCookie(res);

    if (!challenge.account_id) {
      await createSession(res, account.id);
    }

    sendJson(res, 201, {
      message: challenge.account_id ? '추가 패스키가 등록되었습니다.' : '보안 공간과 첫 패스키가 생성되었습니다.',
      account: publicAccount(account),
      challengeFingerprint: beforeConsume?.challenge_fingerprint || challenge.challenge_fingerprint
    });
  } catch (error) {
    clearFlowCookie(res);
    reportUnexpectedError(res, error);
  }
}
