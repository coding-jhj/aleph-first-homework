import { createClient } from '@supabase/supabase-js';

let cachedClient;

function throwDatabaseError(error) {
  const wrapped = new Error(error?.message || 'supabase_query_failed');
  if (error?.code) wrapped.code = error.code;
  if (error?.details) wrapped.details = error.details;
  if (error?.hint) wrapped.hint = error.hint;
  throw wrapped;
}

export function getDb() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('missing_supabase_url');
  if (!serverKey) throw new Error('missing_supabase_server_key');

  cachedClient = createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return cachedClient;
}

export async function fetchRows(table, columns = '*', buildQuery = null) {
  let request = getDb().from(table).select(columns);
  if (buildQuery) request = buildQuery(request) || request;
  const { data, error } = await request;
  if (error) throwDatabaseError(error);
  return data || [];
}

export async function fetchOne(table, columns = '*', buildQuery = null) {
  let request = getDb().from(table).select(columns);
  if (buildQuery) request = buildQuery(request) || request;
  const { data, error } = await request.maybeSingle();
  if (error) throwDatabaseError(error);
  return data || null;
}

export async function insertRows(table, values) {
  const { data, error } = await getDb().from(table).insert(values).select();
  if (error) throwDatabaseError(error);
  return data || [];
}

export async function insertOne(table, values, columns = '*') {
  const { data, error } = await getDb().from(table).insert(values).select(columns).single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function updateRows(table, values, buildQuery = null, columns = null) {
  let request = getDb().from(table).update(values);
  if (buildQuery) request = buildQuery(request) || request;
  if (columns) request = request.select(columns);
  const { data, error } = await request;
  if (error) throwDatabaseError(error);
  return data || [];
}

export async function updateOne(table, values, buildQuery = null, columns = '*') {
  let request = getDb().from(table).update(values);
  if (buildQuery) request = buildQuery(request) || request;
  const { data, error } = await request.select(columns).maybeSingle();
  if (error) throwDatabaseError(error);
  return data || null;
}

export async function deleteRows(table, buildQuery = null) {
  let request = getDb().from(table).delete();
  if (buildQuery) request = buildQuery(request) || request;
  const { data, error } = await request.select();
  if (error) throwDatabaseError(error);
  return data || [];
}
