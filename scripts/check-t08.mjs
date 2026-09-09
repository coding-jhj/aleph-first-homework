import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const index = read('index.html');
const migration = read('supabase/migrations/202609090001_t08_passkey_vault.sql');
const implementation = read('docs/T08_IMPLEMENTATION.md');

const checks = [
  ['public/private UI boundary', index.includes('PUBLIC / PRIVATE BOUNDARY') && index.includes('data-testid="secure-locked"')],
  ['private content is runtime-only', index.includes('/api/private/items') && !index.includes('계정별 작업 메모 01')],
  ['native WebAuthn create/get', index.includes('navigator.credentials.create') && index.includes('navigator.credentials.get')],
  ['no password input', !/type\\s*=\\s*["']password["']/i.test(index)],
  ['synthetic public contact', !index.includes('ghkswnwjd@gmail.com') && !index.includes('정환주')],
  ['registration cancellation UI', index.includes('secure-register-cancel') && index.includes('/api/passkeys/register-cancel')],
  ['private scope is server enforced', read('api/private/items.js').includes("eq('account_id', session.account_id)")],
  ['cross-account rejection', read('api/private/accounts/[accountId]/items.js').includes('account_scope_mismatch')],
  ['one-time challenge consumption', read('api/_lib/challenges.js').includes(".is('consumed_at', null)")],
  ['session token hashing', read('api/_lib/session.js').includes('sha256Hex(rawToken)')],
  ['RLS on every T08 table', [
    't08_accounts', 't08_passkeys', 't08_private_items', 't08_webauthn_challenges',
    't08_sessions', 't08_auth_events'
  ].every((name) => migration.includes('alter table public.' + name + ' enable row level security'))],
  ['client table grants revoked', migration.includes('revoke all on table public.t08_private_items from anon, authenticated')],
  ['six documentation sections', ['①', '②', '③', '④', '⑤', '⑥'].every((mark) => implementation.includes(mark))]
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS ' : 'FAIL ') + name);
}
if (failed.length) process.exitCode = 1;
