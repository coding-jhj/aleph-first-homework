# T08 배포 및 실행 순서

## 1. Neon PostgreSQL 준비

1. Vercel 프로젝트의 Storage/Marketplace에서 Neon을 연결하거나 Neon 콘솔에서 PostgreSQL 데이터베이스를 만든다.
2. Neon의 serverless/pooled connection string을 복사한다. 애플리케이션에서는 이 값을 `DATABASE_URL`로 사용한다.
3. Neon SQL Editor 또는 `psql`에서 `db/migrations/202609090001_t08_passkey_vault.sql`을 실행한다.
4. 다음 여섯 테이블이 생성됐는지 확인한다: `t08_accounts`, `t08_passkeys`, `t08_private_items`, `t08_webauthn_challenges`, `t08_sessions`, `t08_auth_events`.
5. 모든 T08 테이블에 RLS가 켜져 있고, 기본 `PUBLIC` 테이블 권한이 철회됐는지 확인한다. API 서버의 데이터베이스 연결만 테이블에 접근할 수 있어야 한다.

예시 CLI 실행:

~~~bash
psql "$DATABASE_URL" -f db/migrations/202609090001_t08_passkey_vault.sql
~~~

`DATABASE_URL`은 절대 브라우저 코드나 저장소에 커밋하지 않는다.

## 2. Vercel 환경변수

Vercel Project Settings의 Preview와 Production 환경에 다음 값을 넣는다. Preview에서 실제 패스키를 시험할 때는 해당 Preview URL의 hostname을 사용한다.

| 변수 | 값 |
| --- | --- |
| PUBLIC_ORIGIN | 실제 테스트 origin. Production은 `https://aleph-first-homework.vercel.app` |
| WEBAUTHN_RP_ID | `PUBLIC_ORIGIN`의 hostname만 입력. 예: `aleph-first-homework.vercel.app` |
| WEBAUTHN_RP_NAME | 브라우저에 보일 서비스 이름 |
| DATABASE_URL | Neon PostgreSQL의 server-only connection string |
| WEBAUTHN_CHALLENGE_TTL_SECONDS | `300` |
| SESSION_TTL_SECONDS | `28800` |

Production 예시는 다음과 같다.

~~~text
PUBLIC_ORIGIN=https://aleph-first-homework.vercel.app
WEBAUTHN_RP_ID=aleph-first-homework.vercel.app
~~~

`DATABASE_URL`은 Vercel 서버 함수에서만 읽는다. `NEXT_PUBLIC_*`, HTML, 브라우저 JavaScript 변수로 복사하지 않는다.

## 3. 로컬 정적 검사

~~~bash
npm install
npm run syntax
npm run check
~~~

실제 passkey는 HTTPS 또는 localhost에서만 동작한다. origin과 RP ID가 서로 다른 hostname을 가리키면 브라우저가 WebAuthn 요청을 거부한다.

## 4. 브라우저 테스트 계정

- 계정 A: `sample-a`
- 계정 B: `sample-b`
- 각 계정에는 최소 두 개의 passkey nickname을 등록한다. 예: `주 사용 기기`, `보조 기기`
- 각 계정의 private seed는 handle이 달라서 서로 다른 synthetic content가 된다.
- 실제 이름·이메일·비밀번호는 입력하지 않는다.

## 5. 사용자가 직접 해야 하는 마지막 단계

1. Neon을 Vercel 프로젝트에 연결하고 `DATABASE_URL`을 생성한다.
2. migration SQL을 Neon에 한 번 실행한다.
3. Vercel의 Preview/Production 환경변수를 저장하고 재배포한다.
4. 실제 기기에서 등록·로그인·추가 passkey·삭제·로그아웃·challenge replay 테스트를 진행한다.
5. 결과와 화면/API 응답을 `docs/T08_EVIDENCE_TEMPLATE.md`에 기록한다.
