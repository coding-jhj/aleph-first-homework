import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export function newId() {
  return randomUUID();
}

export function newBase64UrlToken(byteLength = 32) {
  return randomBytes(byteLength).toString('base64url');
}

export function newWebAuthnUserId() {
  return isoBase64URL.fromBuffer(randomBytes(32));
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function fingerprint(value) {
  return sha256Hex(value).slice(0, 16);
}
