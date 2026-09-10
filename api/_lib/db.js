import { neon } from '@neondatabase/serverless';

let cachedClient;

export function getDb() {
  if (cachedClient) return cachedClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('missing_database_url');
  }

  cachedClient = neon(connectionString);
  return cachedClient;
}

export async function query(text, params = []) {
  return getDb().query(text, params);
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    const error = new Error('unexpected_multiple_rows');
    error.code = 'unexpected_cardinality';
    throw error;
  }
  return rows[0];
}

export async function execute(text, params = []) {
  await query(text, params);
}

export function jsonParam(value) {
  return JSON.stringify(value ?? {});
}
