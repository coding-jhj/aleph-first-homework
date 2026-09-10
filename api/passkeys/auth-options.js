import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getConfig } from '../_lib/config.js';
import { query } from '../_lib/db.js';
import { getAccountByHandle } from '../_lib/accounts.js';
import { storeChallenge } from '../_lib/challenges.js';
import { isHttpMethod, methodNotAllowed, readJson, sendError, sendJson, reportUnexpectedError, stringValue } from '../_lib/http.js';

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-_]{2,31}$/;

export default async function handler(req, res) {
  if (!isHttpMethod(req, 'POST')) {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const body = await readJson(req);
    const handle = stringValue(body.handle, 32).toLowerCase();
    if (!HANDLE_PATTERN.test(handle)) {
      sendError(res, 400, '로그인할 공개 별칭을 입력해 주세요.', 'invalid_handle');
      return;
    }

    const account = await getAccountByHandle(handle);
    if (!account) {
      sendError(res, 404, '등록된 공개 별칭을 찾을 수 없습니다.', 'account_not_found');
      return;
    }

    const passkeys = await query(
      `select credential_id, transports
       from public.t08_passkeys
       where account_id = $1
       order by created_at asc`,
      [account.id]
    );
    if (!passkeys || passkeys.length === 0) {
      sendError(res, 409, '이 계정에는 사용할 패스키가 없습니다. zero-passkey 상태입니다.', 'no_passkeys');
      return;
    }

    const config = getConfig();
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports || undefined
      }))
    });
    const challenge = await storeChallenge(res, {
      kind: 'authentication',
      accountId: account.id,
      handle: account.handle,
      challenge: options.challenge,
      metadata: { handle: account.handle }
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
