import { getDb } from './db.js';

export async function getAccountById(id) {
  const { data, error } = await getDb()
    .from('t08_accounts')
    .select('id,handle,display_name,webauthn_user_id,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getAccountByHandle(handle) {
  const { data, error } = await getDb()
    .from('t08_accounts')
    .select('id,handle,display_name,webauthn_user_id,created_at')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
