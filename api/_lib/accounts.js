import { fetchOne } from './db.js';

const ACCOUNT_COLUMNS = 'id, handle, display_name, webauthn_user_id, created_at';

export async function getAccountById(id) {
  return fetchOne('t08_accounts', ACCOUNT_COLUMNS, (query) => query.eq('id', id).limit(1));
}

export async function getAccountByHandle(handle) {
  return fetchOne('t08_accounts', ACCOUNT_COLUMNS, (query) => query.eq('handle', handle).limit(1));
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
