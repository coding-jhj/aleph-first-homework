# T08 Passkey Private Portfolio 구현 문서

상태: Supabase PostgreSQL 전환, 코드·문서·정적 검증 구현 완료. 실제 WebAuthn 기기 테스트와 배포 증거는 Supabase migration과 Vercel 환경변수 입력 후 기록해야 한다.

## ① 무엇을 사용했나

- 직접 구현: 공개 포트폴리오 안의 public/private 경계 UI, 등록·로그인·로그아웃·패스키 삭제 흐름, 계정 소유권 검사, HttpOnly 세션 쿠키, challenge 일회성 소비, 보안 이벤트 기록.
- 브라우저 인증: 표준 Web Authentication API의 `navigator.credentials.create/get`.
- 서버 검증 라이브러리: `@simplewebauthn/server` 13.3.3. 사용 API는 `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse`다.
- 데이터베이스: Supabase managed PostgreSQL.
- 데이터베이스 클라이언트: `@supabase/supabase-js` 2.116.0. 서버 함수가 Supabase Data API를 통해서만 테이블을 호출한다.
- 실행 환경: Vercel Node.js Functions. 브라우저에는 Supabase 서버 키나 private 데이터베이스 자격증명을 전달하지 않는다.

## ② 왜 이렇게 사용했나

T08의 핵심은 로그인 화면을 꾸미는 것이 아니라 “서버가 challenge와 공개 키로 서명을 검증한 뒤에만 private 응답을 내리는가”다. 따라서 계정별 passkey public key와 authenticator counter는 PostgreSQL에 저장하고, private 응답은 세션의 `account_id`로만 조회한다.

패스키의 private key는 기기·보안 키 밖으로 전송하지 않는다. 서버에는 검증용 public key만 저장한다. 세션 cookie에는 opaque random token을 넣고 데이터베이스에는 SHA-256 digest만 저장한다. security event에는 raw session, signature, credential material을 남기지 않고 짧은 fingerprint만 남긴다.

사용자가 보는 passkey 저장 위치는 브라우저와 인증기의 정책에 따른다. 예를 들어 Chrome 계열에서는 Google Password Manager에 동기화될 수 있고, 운영체제의 기기 인증기 또는 별도 FIDO2 보안 키에 저장될 수 있다. 이 구현은 저장 위치를 서버에서 선택하거나 읽지 않고, 브라우저 WebAuthn API에 위임한다.

기존 T01 public portfolio는 첫 화면과 기존 섹션을 유지했다. private 영역은 별도 어두운 패널로 분리했고, 로그아웃 상태의 초기 HTML에는 private record의 실제 title/content를 넣지 않았다. 제출용 표시 이름과 연락처는 JHJ/hello@example.com이라는 synthetic data로 바꾸었고, seed 자료도 제출 시나리오용 synthetic data다.

## ③ 무엇을 어떻게 바꿨나

| 사용자 흐름 | 구현 위치 | 서버에서 확인하는 것 |
| --- | --- | --- |
| 첫 passkey 등록 옵션 | `api/passkeys/register-options.js` | 새 registration challenge를 만들고 `t08_webauthn_challenges`에 저장 |
| 첫 passkey 등록 검증 | `api/passkeys/register-verify.js` | challenge 만료·재사용 여부, origin, RP ID, attestation 서명 검증 후에만 account/passkey/private seed 생성 |
| 추가 passkey 등록 | 같은 register-options/register-verify | 현재 HttpOnly session의 `account_id`를 기준으로만 등록 |
| passkey 로그인 옵션 | `api/passkeys/auth-options.js` | 계정의 등록 credential만 allowCredentials로 넣고 매번 새 authentication challenge 생성 |
| passkey 로그인 검증 | `api/passkeys/auth-verify.js` | challenge 일회성 소비, credential 소유 계정 일치, 저장 public key 서명, origin/RP ID, user verification, counter 검증 후 세션 생성 |
| 로그아웃 | `api/session/logout.js` | 현재 token digest의 세션을 revoked 처리하고 cookie 삭제 |
| 내 private 자료 읽기 | `api/private/items.js` | request body/query의 계정 값이 아니라 `session.account_id`로만 조회 |
| 다른 계정 URL 접근 | `api/private/accounts/[accountId]/items.js` | URL accountId가 session.account_id와 다르면 403과 authorization_denied 이벤트 |
| 패스키 목록/삭제 | `api/passkeys/index.js`, `api/passkeys/[passkeyId].js` | 현재 계정의 nickname/date만 노출하고 소유자 일치 시에만 삭제 |
| 성공·실패·replay 기록 | `api/_lib/events.js`, `api/security/events.js` | event type, success, reason code, challenge/credential fingerprint만 기록·조회 |
| 스키마와 권한 | `db/migrations/202609090001_t08_passkey_vault.sql` | 모든 T08 테이블 RLS 활성화, `anon`/`authenticated` 직접 테이블 권한 철회, `service_role`만 서버 접근 |

인증 실패는 401, 계정 scope가 다른 private 요청은 403이다. registration challenge와 authentication challenge는 각각 5분 후 만료되고 `consumed_at`이 한 번 기록되면 다시 쓸 수 없다.

## ④ 거부 동작을 증명하는 기록

아래 표는 제출 시 실제 브라우저·API 테스트 결과를 양쪽에 기록하는 형식이다. 현재 작업 환경에는 사용자의 Supabase 서버 키와 실제 passkey 기기가 없으므로, 빈 칸을 통과로 표시하지 않았다.

| 검사 | 성공 쪽 | 거부 쪽 | 실제 증거 |
| --- | --- | --- | --- |
| no-login private read | passkey 로그인 후 GET `/api/private/items`가 현재 계정의 synthetic record 3개 이상 반환 | cookie 없이 같은 요청은 401 `authentication_required`, private body 없음 | 배포 후 기록 필요 |
| other-passkey / other-account | A로 로그인하면 A 자료만 반환 | A 세션으로 B URL을 읽으면 403 `account_scope_mismatch`, B 자료·count 없음. B도 역방향 동일 | 배포 후 기록 필요 |
| challenge replay | 새 login challenge와 정상 assertion으로 200 및 session 생성 | 같은 challenge/assertion을 재전송하면 401 `challenge_rejected`, challenge_fingerprint 이벤트 기록 | 배포 후 기록 필요 |
| deleted-passkey login | 두 passkey 중 하나를 삭제한 뒤 남은 passkey로 200 로그인 | 삭제한 credential로 시도하면 401 `credential_not_registered` 또는 `signature_verification_failed` 이벤트 기록 | 배포 후 기록 필요 |

거부 판정의 source of truth는 `api/passkeys/auth-verify.js`와 `api/private/accounts/[accountId]/items.js`다. 보안 이벤트의 예시 응답은 fingerprint만 포함하고 session token·서명·private key는 포함하지 않는다.

## ⑤ AI가 한 일과 제출자가 결정할 일

### AI가 수행한 일

- GitHub 저장소의 기존 단일 `index.html` 전체 구조와 기존 public 섹션을 분석했다.
- T08 requirement.txt의 C01~C53을 기능·보안·문서 항목으로 매핑했다.
- native WebAuthn 브라우저 호출, Vercel API route, Supabase PostgreSQL schema, 계정 scope 검사, 세션·challenge·event 기록을 구현했다.
- 기존 데이터베이스 클라이언트 의존성을 제거하고 `@supabase/supabase-js` server client 기반 데이터 접근 helper로 교체했다.
- 정적 syntax/check 스크립트를 작성하고 실행 가능한 형태로 구성했다.

### 현재 반영한 제출자 결정

- 기존 public portfolio의 시각적 내용은 유지하고 private 영역만 추가한다.
- 실제 개인 정보 대신 sample-a/sample-b 같은 synthetic handle을 사용한다.
- 실제 private 자료는 HTML source가 아니라 인증 후 API 응답에서만 만든다.
- 계정 생성과 첫 passkey 등록을 하나의 사용자 흐름으로 묶고, 추가 기기 passkey를 별도로 제공한다.

### 따르지 않은 제안과 이유

- 새 이미지를 생성하거나 기존 화면을 전면 재디자인하지 않았다. 이번 과제의 중심은 기존 T01 결과 보존과 접근 제어 증명이고, 전면 재디자인은 요구 범위를 늘리기 때문이다.
- 브라우저용 인증 라이브러리 CDN을 추가하지 않고 표준 WebAuthn API를 직접 사용했다. 현재 페이지가 CDN 기반 단일 HTML이므로 추가 런타임 CDN 실패 지점을 줄이고, 서버 검증 라이브러리와 브라우저 표준 API의 역할을 분리하기 위한 선택이다.

## ⑥ 아직 막혀 있는 구체적 한계

1. Supabase 프로젝트에 migration을 원격 적용해야 한다.
2. Vercel Preview/Production에 `PUBLIC_ORIGIN`, `WEBAUTHN_RP_ID`, `SUPABASE_URL`, 서버 전용 Supabase 키 등을 입력하지 않으면 API는 의도적으로 private 자료를 반환하지 않는다.
3. 실제 passkey 등록·로그인·삭제·replay 테스트는 HTTPS 브라우저와 플랫폼 authenticator 또는 보안 키가 필요하다. 일반 curl만으로는 유효한 WebAuthn 서명을 만들 수 없으므로 CI 정적 검사만으로 C19~C45 통과를 주장할 수 없다.
4. 마지막 passkey를 삭제하면 계정의 등록 passkey가 0개가 되고 현재 세션도 종료된다. 복구 이메일이나 관리자 재등록 기능은 이 T08 범위에 넣지 않았다.

### 제출용 짧은 확인 절차

1. migration 적용 후 Vercel 환경변수를 넣고 결과 URL을 연다.
2. sample-a를 만들고 첫 passkey를 등록한 뒤, 추가 passkey를 하나 더 등록·로그인·로그아웃한다.
3. 로그아웃 상태의 private 요청, 다른 accountId 요청, challenge/assertion 재사용, 삭제한 passkey 재로그인을 각각 실행하고 401/403 및 security event를 캡처한다.

### 통과/실패의 눈으로 보이는 결과

- 통과: public portfolio는 인증 없이 보이고, 인증 후에만 Private records 3개 이상과 Passkey list가 보인다.
- 실패: cookie 없는 private GET은 401, 다른 accountId private GET은 403, replay/deleted credential은 401이며 response에 private record가 없다.
