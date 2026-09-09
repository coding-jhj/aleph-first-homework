-- T08 passkey vault schema.
-- All application reads/writes go through Vercel server functions using the
-- Neon/PostgreSQL connection string. Browser clients never receive direct
-- table grants; the API is the only database client.

create extension if not exists pgcrypto;

create table if not exists public.t08_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  webauthn_user_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.t08_passkeys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.t08_accounts(id) on delete cascade,
  credential_id text not null unique,
  -- This is the WebAuthn credential public key, never a password or private key.
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}'::text[],
  device_type text not null default 'singleDevice',
  backed_up boolean not null default false,
  nickname text not null check (char_length(nickname) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists t08_passkeys_account_id_idx on public.t08_passkeys(account_id);

create table if not exists public.t08_private_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.t08_accounts(id) on delete cascade,
  title text not null,
  content text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists t08_private_items_account_sort_idx
  on public.t08_private_items(account_id, sort_order, created_at);

create table if not exists public.t08_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('registration', 'authentication')),
  account_id uuid references public.t08_accounts(id) on delete cascade,
  handle text,
  challenge text not null,
  challenge_fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists t08_challenges_expiry_idx
  on public.t08_webauthn_challenges(expires_at);

create table if not exists public.t08_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.t08_accounts(id) on delete cascade,
  -- Only a SHA-256 digest is stored. The opaque cookie value is never stored.
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists t08_sessions_account_idx on public.t08_sessions(account_id);
create index if not exists t08_sessions_expiry_idx on public.t08_sessions(expires_at);

create table if not exists public.t08_auth_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.t08_accounts(id) on delete set null,
  -- Only short fingerprints are retained for evidence; raw tokens/signatures
  -- and full credential material are intentionally not logged.
  credential_fingerprint text,
  event_type text not null check (
    event_type in (
      'registration_verified',
      'registration_failed',
      'authentication_verified',
      'authentication_failed',
      'challenge_rejected',
      'authorization_denied',
      'passkey_deleted',
      'logout'
    )
  ),
  success boolean not null,
  reason_code text not null,
  challenge_fingerprint text,
  created_at timestamptz not null default now()
);

create index if not exists t08_auth_events_account_created_idx
  on public.t08_auth_events(account_id, created_at desc);

alter table public.t08_accounts enable row level security;
alter table public.t08_passkeys enable row level security;
alter table public.t08_private_items enable row level security;
alter table public.t08_webauthn_challenges enable row level security;
alter table public.t08_sessions enable row level security;
alter table public.t08_auth_events enable row level security;

-- Neon is plain managed PostgreSQL, so revoke the default PUBLIC privileges.
revoke all on table public.t08_accounts from public;
revoke all on table public.t08_passkeys from public;
revoke all on table public.t08_private_items from public;
revoke all on table public.t08_webauthn_challenges from public;
revoke all on table public.t08_sessions from public;
revoke all on table public.t08_auth_events from public;
