import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export async function makeRegistrationOptions(config, account, existingPasskeys) {
  return generateRegistrationOptions({
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
}

export async function makeAuthenticationOptions(config, passkeys) {
  return generateAuthenticationOptions({
    rpID: config.rpId,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id,
      transports: passkey.transports || undefined
    }))
  });
}

export async function verifyRegistration(config, response, challenge) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: config.publicOrigin,
    expectedRPID: config.rpId,
    requireUserVerification: true
  });
}

export async function verifyAuthentication(config, response, challenge, passkey) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: config.publicOrigin,
    expectedRPID: config.rpId,
    credential: {
      id: passkey.credential_id,
      publicKey: isoBase64URL.toBuffer(passkey.public_key),
      counter: Number(passkey.counter),
      transports: passkey.transports || undefined
    },
    requireUserVerification: true
  });
}

export function registrationToRow(verification) {
  const credential = verification.registrationInfo?.credential;
  if (!credential) throw new Error('registration_credential_missing');
  return {
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: Number(credential.counter),
    transports: credential.transports || [],
    device_type: verification.registrationInfo.credentialDeviceType,
    backed_up: Boolean(verification.registrationInfo.credentialBackedUp)
  };
}
