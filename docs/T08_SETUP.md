# T08 배포 및 실행 순서

## 1. Supabase

1. 사용할 Supabase 프로젝트를 활성화한다. 현재 연결된 프로젝트가 INACTIVE라면 이 단계가 먼저다.
2. Supabase SQL Editor 또는 Supabase CLI로 supabase/migrations/202609090001_t08_passkey_vault.sql을 적용한다.
3. t08_accounts, t08_passkeys, t08_private_items, t08_webauthn_challenges, t08_sessions, t08_auth_events가 생성됐는지 확인한다.
4. anon/authenticated 역할에 T08 테이블 직접 grant가 없는지 확인한다. API는 서버 secret으로만 접근한다.

## 2. Vercel 환경변수

Vercel Project Settings의 Preview와 Production 환경에 다음 값을 넣는다.

| 변수 | 값 |
| --- | --- |
| PUBLIC_ORIGIN | 실제 테스트 origin. Production은 https://aleph-first-homework.vercel.app, Preview는 해당 preview URL |
| WEBAUTHN_RP_ID | PUBLIC_ORIGIN의 hostname |
| WEBAUTHN_RP_NAME | 브라우저에 보일 서비스 이름 |
| SUPABASE_URL | Supabase Project URL |
| SUPABASE_SECRET_KEY | Supabase의 server-only sb_secret key |
| WEBAUTHN_CHALLENGE_TTL_SECONDS | 300 |
| SESSION_TTL_SECONDS | 28800 |

SUPABASE_SECRET_KEY는 브라우저 코드, index.html, public 환경변수에 넣지 않는다. 오래된 프로젝트에서만 SUPABASE_SERVICE_ROLE_KEY를 임시 fallback으로 사용할 수 있지만, 새 설정은 sb_secret key를 우선한다.

## 3. 로컬 정적 검사

~~~text
npm install
npm run syntax
npm run check
~~~

실제 passkey는 HTTPS 또는 localhost에서만 동작한다. Vercel preview를 사용할 때 PUBLIC_ORIGIN과 WEBAUTHN_RP_ID를 그 preview hostname에 맞춰야 한다.

## 4. 브라우저 테스트 계정

- 계정 A: sample-a
- 계정 B: sample-b
- 각 계정에는 최소 두 개의 passkey nickname을 등록한다. 예: 주 사용 기기, 보조 기기
- 각 계정의 private seed는 handle이 달라서 서로 다른 synthetic content가 된다.
- 실제 이름·이메일·비밀번호는 입력하지 않는다.
