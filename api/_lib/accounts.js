import { queryOne } from './db.js';

export async function getAccountById(id) {
  return queryOne(
    `select id, handle, display_name, webauthn_user_id, created_at
     from public.t08_accounts
     where id = $1
     limit 1`,
    [id]
  );
}

export async function getAccountByHandle(handle) {
  return queryOne(
    `select id, handle, display_name, webauthn_user_id, created_at
     from public.t08_accounts
     where handle = $1
     limit 1`,
    [handle]
  );
}

export function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    handle: account.handle,
    display_name: account.display_name,
    created_at: account.created_at
  };
}
