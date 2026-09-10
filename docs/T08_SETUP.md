# T08 배포 및 실행 순서

이 프로젝트는 Supabase의 PostgreSQL과 Data API를 사용합니다. Neon이나 별도 PostgreSQL 서버는 필요하지 않습니다.

## 1. Supabase 프로젝트 1개 준비

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. 기존에 사용 중인 프로젝트가 있으면 그 프로젝트 하나를 선택합니다.
3. 없다면 `New project`를 눌러 프로젝트를 하나만 만듭니다.
4. 데이터베이스 비밀번호는 안전한 곳에 보관합니다. 이번 구현은 브라우저에서 직접 DB에 연결하지 않으므로 일반 사용자에게 공개하지 않습니다.

이 과제에서 `sample-a`, `sample-b`는 Supabase 프로젝트가 아닙니다. 같은 프로젝트의 `t08_accounts` 테이블에 저장되는 계정 행입니다. 무료 플랜에서 앱 사용자 수 때문에 프로젝트를 추가로 만들 필요가 없습니다.

## 2. Supabase 키 확인

Supabase 프로젝트 화면에서 `Project Settings` → `API`로 이동합니다.

| Dashboard에서 찾는 값 | 복사할 위치 | Vercel 변수 |
| --- | --- | --- |
| Project URL | API 화면의 `Project URL` | `SUPABASE_URL` |
| 서버 전용 키 | `Secret keys`의 `sb_secret_...` 키 | `SUPABASE_SECRET_KEY` |
| 구형 키를 쓰는 경우 | `Legacy API Keys`의 `service_role` 키 | `SUPABASE_SERVICE_ROLE_KEY` |

`SUPABASE_SECRET_KEY`와 `SUPABASE_SERVICE_ROLE_KEY` 중 하나만 넣으면 됩니다. `publishable`/`anon` 키를 서버 전용 키 자리에 넣지 않습니다.

서버 전용 키는 GitHub, README, 브라우저 JavaScript, HTML, 채팅, 캡처 화면에 절대 넣지 않습니다. 키가 노출되면 Supabase Dashboard에서 즉시 rotate합니다.

## 3. 데이터베이스 테이블 만들기

1. Supabase 프로젝트 왼쪽 메뉴에서 `SQL Editor`를 엽니다.
2. `New query`를 누릅니다.
3. 저장소의 `db/migrations/202609090001_t08_passkey_vault.sql` 파일 전체를 복사합니다.
4. SQL Editor에 붙여 넣고 `Run`을 누릅니다.
5. 성공 메시지를 확인합니다.

생성되는 테이블은 다음 6개입니다.

~~~text
t08_accounts
t08_passkeys
t08_private_items
t08_webauthn_challenges
t08_sessions
t08_auth_events
~~~

SQL Editor에서 생성 확인:

~~~sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 't08_%'
order by table_name;
~~~

RLS 확인:

~~~sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 't08_%'
order by tablename;
~~~

여섯 행의 `rowsecurity`가 모두 `true`여야 합니다. migration에는 일반 `anon`/`authenticated` 역할의 테이블 접근 차단과 서버 역할 권한 부여도 포함되어 있습니다.

## 4. Supabase Data API 확인

이 구현의 서버 함수는 `@supabase/supabase-js`로 Supabase Data API를 호출합니다.

1. Supabase 프로젝트에서 `Integrations` → `Data API`를 엽니다. 화면에 따라 `Project Settings` → `API` 안에 보일 수 있습니다.
2. Data API가 켜져 있는지 확인합니다.
3. `public` 스키마가 exposed schemas에 포함되어 있는지 확인합니다.
4. 테이블 접근 오류가 나면 SQL Editor에서 다음을 실행합니다.

~~~sql
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.t08_accounts,
  public.t08_passkeys,
  public.t08_private_items,
  public.t08_webauthn_challenges,
  public.t08_sessions,
  public.t08_auth_events
  to service_role;
~~~

일반 브라우저 요청에는 `anon`/`authenticated` 키를 사용하지 않고, 애플리케이션 테이블도 해당 역할에 열지 않습니다. 브라우저는 항상 Vercel API만 호출합니다.

## 5. Vercel 환경변수 입력

1. [Vercel Dashboard](https://vercel.com/dashboard)에서 `aleph-first-homework` 프로젝트를 엽니다.
2. `Settings` → `Environment Variables`로 이동합니다.
3. 아래 7개를 추가합니다.

| 변수명 | 값 |
| --- | --- |
| `SUPABASE_URL` | Supabase API 화면의 Project URL 전체 |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` 서버 전용 키 |
| `PUBLIC_ORIGIN` | 실제 Production URL 전체, 예: `https://aleph-first-homework.vercel.app` |
| `WEBAUTHN_RP_ID` | URL의 hostname만, 예: `aleph-first-homework.vercel.app` |
| `WEBAUTHN_RP_NAME` | `AI Engineer Portfolio private space` |
| `WEBAUTHN_CHALLENGE_TTL_SECONDS` | `300` |
| `SESSION_TTL_SECONDS` | `28800` |

구형 `service_role` 키를 쓰면 `SUPABASE_SECRET_KEY` 대신 변수명 `SUPABASE_SERVICE_ROLE_KEY`로 저장합니다. 코드가 둘 중 하나를 읽습니다.

주의:

- `PUBLIC_ORIGIN`에는 `https://`를 포함합니다.
- `WEBAUTHN_RP_ID`에는 `https://`, 경로(`/`)를 넣지 않습니다.
- Production에서 테스트할 때는 Production URL의 hostname을 사용합니다. Preview URL마다 hostname이 바뀌면 passkey가 다른 사이트로 취급될 수 있습니다.
- `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`는 `NEXT_PUBLIC_*`처럼 브라우저로 전달되는 이름을 사용하지 않습니다.

## 6. 재배포

1. 환경변수를 저장합니다.
2. Vercel `Deployments`에서 최신 배포를 엽니다.
3. `Redeploy`를 누릅니다.
4. 상태가 `Ready`가 될 때까지 기다립니다.

환경변수는 새 배포부터 반영됩니다. 기존 배포가 성공했다고 해서 새 환경변수가 자동으로 반영된 것은 아닙니다.

## 7. 기본 API 확인

로그인하지 않은 브라우저에서 Production URL을 열고 개발자 도구 Console에서 실행합니다.

~~~js
await fetch('/api/private/items')
  .then(async (r) => ({ status: r.status, body: await r.json() }))
~~~

기대 결과는 다음과 같습니다.

~~~text
status: 401
body.code: authentication_required
~~~

이 테스트는 Supabase 연결 오류가 아니라 애플리케이션이 로그인 전 private 데이터를 막고 있다는 뜻입니다. `500 server_error`가 나오면 환경변수, migration, Data API 노출을 먼저 확인합니다.

## 8. 실제 passkey 테스트

### 계정 A

1. 공개 별칭 `sample-a`를 입력합니다.
2. 표시 이름 `Sample Account A`를 입력합니다.
3. passkey 이름 `주 사용 기기`를 입력합니다.
4. 등록 버튼을 누르고 Windows Hello·휴대전화 passkey·FIDO2 키 중 하나로 승인합니다.
5. private records 3개 이상과 Passkey list가 표시되는지 확인합니다.

### 추가 기기

1. `sample-a`로 로그인된 상태에서 추가 passkey 등록을 누릅니다.
2. nickname `보조 기기`를 입력합니다.
3. 다른 authenticator로 승인합니다.
4. 목록에 두 개가 표시되는지 확인합니다.

### 로그아웃·재로그인

1. 로그아웃 후 private 영역이 잠기는지 확인합니다.
2. `sample-a`로 다시 passkey 로그인합니다.
3. 같은 계정의 private records가 다시 표시되는지 확인합니다.

### 계정 B 격리

1. 로그아웃합니다.
2. `sample-b`와 `Sample Account B`로 첫 passkey를 등록합니다.
3. A와 B의 private records와 passkey 목록이 서로 섞이지 않는지 확인합니다.

## 9. 보안 거부 테스트

### 다른 accountId

현재 세션의 account ID 확인:

~~~js
await fetch('/api/session', { credentials: 'include' }).then((r) => r.json())
~~~

A로 로그인한 상태에서 B ID를 넣어 요청합니다.

~~~js
await fetch('/api/private/accounts/B_ACCOUNT_ID/items', {
  credentials: 'include'
}).then(async (r) => ({ status: r.status, body: await r.json() }))
~~~

기대 결과는 `403`과 `account_scope_mismatch`입니다.

### Challenge replay

1. DevTools Network에서 정상 로그인 요청을 찾습니다.
2. `auth-verify` 요청을 `Copy as cURL`로 복사합니다.
3. 같은 요청을 한 번 더 실행합니다.
4. `401 challenge_rejected`가 되는지 확인합니다.
5. `/api/security/events`에서 fingerprint와 reason code를 확인합니다.

### Passkey 삭제

1. 한 계정에 passkey 두 개를 등록합니다.
2. 하나를 삭제합니다.
3. 남은 passkey로 로그인합니다.
4. 가능하면 삭제된 credential로도 시도해 `401` 거부를 확인합니다.
5. 마지막 passkey를 삭제하면 해당 계정의 세션도 종료됩니다.

## 10. 증거 기록과 제출

실제 결과는 [T08 증거 양식](T08_EVIDENCE_TEMPLATE.md)에 기록합니다. 기대 결과를 미리 통과로 적지 말고, 실제 status·response code·화면 또는 Network 캡처를 넣습니다.

제출 전에 다음을 모두 확인합니다.

- GitHub `main`에 최신 코드가 있음
- Supabase migration 적용 완료
- Vercel 배포 상태 `Ready`
- Production에서 public portfolio가 로그인 없이 보임
- private read가 로그인 전 401
- 정상 passkey 로그인 후 private records 표시
- A/B account scope, replay, 삭제 credential 거부 증거 확보
