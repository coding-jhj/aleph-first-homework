import { getConfig } from '../_lib/config.js';
import { getDb } from '../_lib/db.js';
import { getAccountByHandle, getAccountById } from '../_lib/accounts.js';
import { newWebAuthnUserId } from '../_lib/crypto.js';
import { storeChallenge } from '../_lib/challenges.js';
import { findSession } from '../_lib/session.js';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { isHttpMethod, methodNotAllowed, readJson, sendError, sendJson, reportUnexpectedError, stringValue } from '../_lib/http.js';

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-_]{2,31}$/;

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const body = await readJson(req);
    const nickname = stringValue(body.nickname, 80);
    if (!nickname) {
      sendError(res, 400, '패스키 이름이 필요합니다.', 'invalid_nickname');
      return;
    }

    const config = getConfig();
    const session = await findSession(req);
    let account;
    let existingPasskeys = [];
    let metadata;

    if (session) {
      account = await getAccountById(session.account_id);
      if (!account) {
        sendError(res, 401, '세션의 계정을 찾을 수 없습니다.', 'account_not_found');
        return;
      }
      const { data, error } = await getDb()
        .from('t08_passkeys')
        .select('credential_id,transports')
        .eq('account_id', account.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      existingPasskeys = data || [];
      metadata = {
        mode: 'add',
        nickname,
        accountId: account.id
      };
    } else {
      const handle = stringValue(body.handle, 32).toLowerCase();
      if (!HANDLE_PATTERN.test(handle)) {
        sendError(res, 400, '공개 별칭은 영문 소문자·숫자·하이픈·밑줄 3~32자여야 합니다.', 'invalid_handle');
        return;
      }
      const existingAccount = await getAccountByHandle(handle);
      if (existingAccount) {
        sendError(res, 409, '이미 등록된 공개 별칭입니다. 패스키 로그인을 사용해 주세요.', 'handle_already_exists');
        return;
      }
      account = {
        id: null,
        handle,
        display_name: stringValue(body.displayName, 80) || handle,
        webauthn_user_id: newWebAuthnUserId()
      };
      metadata = {
        mode: 'create',
        handle,
        displayName: account.display_name,
        nickname,
        webauthnUserId: account.webauthn_user_id
      };
    }

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      userName: account.handle,
      userID: isoBase64URL.toBuffer(account.webauthn_user_id),
      userDisplayName: account.display_name,
      attestationType: 'none',
      timeout: 60000,
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports || undefined
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required'
      }
    });

    const challenge = await storeChallenge(res, {
      kind: 'registration',
      accountId: account.id,
      handle: account.handle,
      challenge: options.challenge,
      metadata
    });

    sendJson(res, 200, {
      options,
      challengeFingerprint: challenge.challengeFingerprint,
      expiresAt: challenge.expiresAt
    });
  } catch (error) {
    reportUnexpectedError(res, error);
  }
}
