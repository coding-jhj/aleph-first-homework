# T08 Passkey Private Portfolio

기존 public portfolio 안에 WebAuthn passkey로 보호되는 private workspace를 추가한 과제다.
브라우저는 표준 Web Authentication API를 사용하고, Vercel Node.js Functions가 passkey 서명을 검증한 뒤 Neon PostgreSQL에서 현재 계정의 private 자료만 조회한다.

## 먼저 알아둘 것

- 데이터베이스는 Neon PostgreSQL이다.
- 브라우저에는 DATABASE_URL을 전달하지 않는다.
- passkey private key는 기기 또는 인증기에 남고, 서버에는 검증용 public key만 저장한다.
- 로그아웃 상태의 초기 HTML에는 private record의 실제 내용이 들어 있지 않다.
- 아래 정적 검사는 구현 상태를 확인하지만, 실제 passkey 기기 테스트를 대신하지 않는다.
- 실제 운영 완료에는 Neon migration 실행, Vercel 환경변수 입력, HTTPS에서의 WebAuthn 테스트가 필요하다.

## 전체 작업 순서

처음부터 끝까지 다음 순서로 진행한다.

1. GitHub의 최신 코드를 main에 반영한다.
2. Neon PostgreSQL 데이터베이스를 만든다.
3. T08 migration SQL을 Neon에 한 번 실행한다.
4. Vercel에 저장소를 연결하고 환경변수를 입력한다.
5. Vercel Production을 배포한다.
6. 로그인하지 않은 상태의 public/private 경계를 확인한다.
7. sample-a 계정과 첫 passkey를 등록한다.
8. sample-a에 두 번째 passkey를 추가한다.
9. 로그아웃 후 passkey로 다시 로그인한다.
10. sample-b를 별도로 등록해 계정별 자료가 분리되는지 확인한다.
11. 다른 계정 URL 접근, challenge replay, passkey 삭제 거부 동작을 시험한다.
12. 화면·Network·API 응답을 캡처해 docs/T08_EVIDENCE_TEMPLATE.md에 기록한다.

## 1. 저장소 구조

| 경로 | 역할 |
| --- | --- |
| index.html | public portfolio와 private workspace UI |
| api/passkeys/* | passkey 등록·로그인·취소·목록·삭제 API |
| api/private/* | 현재 세션 계정의 private 자료 API |
| api/session* | 세션 조회·로그아웃 API |
| api/security/events.js | 인증·인가 보안 이벤트 API |
| api/_lib/db.js | Neon PostgreSQL 연결과 parameterized query helper |
| api/_lib/webauthn.js | @simplewebauthn/server 검증 helper |
| db/migrations/202609090001_t08_passkey_vault.sql | PostgreSQL 테이블·인덱스·RLS·권한 migration |
| docs/T08_SETUP.md | 배포 설정 요약 |
| docs/T08_IMPLEMENTATION.md | 구현·보안·한계 설명 |
| docs/T08_EVIDENCE_TEMPLATE.md | 제출용 검증 증거 양식 |
| scripts/check-syntax.mjs | API JavaScript와 HTML JSX 문법 검사 |
| scripts/check-t08.mjs | T08 요구사항 정적 검사 |

## 2. 로컬 코드 확인

Node.js 20 이상을 준비한다.

~~~bash
git clone https://github.com/coding-jhj/aleph-first-homework.git
cd aleph-first-homework
npm ci
npm run syntax
npm run check
~~~

Windows PowerShell에서 npm.ps1 실행 정책 오류가 나면 같은 명령의 앞에 .cmd를 붙인다.

~~~powershell
npm.cmd ci
npm.cmd run syntax
npm.cmd run check
~~~

정상 결과는 다음과 같다.

- Syntax check passed: 24 API files + index.html JSX
- T08 검사 항목 전체 PASS
- 의존성 보안 검사:

~~~bash
npm audit --omit=dev --audit-level=high
~~~

## 3. Neon PostgreSQL 만들기

Vercel 프로젝트의 Marketplace에서 Neon을 연결하거나 Neon 콘솔에서 PostgreSQL 프로젝트를 만든다.

1. Neon 프로젝트를 생성한다.
2. 애플리케이션이 사용할 database와 branch를 확인한다.
3. Neon의 PostgreSQL connection string을 복사한다.
4. 연결 문자열이 다음처럼 postgresql://로 시작하는지 확인한다.

~~~text
postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
~~~

연결 문자열은 비밀번호가 포함된 서버 비밀값이다. GitHub, README, 브라우저 코드, 화면 캡처에 넣지 않는다.

## 4. Neon에 migration 실행하기

이 저장소의 다음 파일 전체를 Neon SQL Editor에 붙여 넣고 실행한다.

~~~text
db/migrations/202609090001_t08_passkey_vault.sql
~~~

로컬에 psql이 설치되어 있고 DATABASE_URL을 환경변수로 설정했다면 다음처럼 실행할 수 있다.

~~~bash
psql "$DATABASE_URL" -f db/migrations/202609090001_t08_passkey_vault.sql
~~~

migration은 다음 테이블을 만든다.

- t08_accounts
- t08_passkeys
- t08_private_items
- t08_webauthn_challenges
- t08_sessions
- t08_auth_events

Neon SQL Editor에서 생성 여부를 확인한다.

~~~sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 't08_%'
order by table_name;
~~~

RLS 활성화 여부도 확인한다.

~~~sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 't08_%'
order by tablename;
~~~

여섯 테이블의 rowsecurity가 true인지 확인한다. 애플리케이션 API는 Neon 연결 문자열을 사용하는 서버 함수에서만 테이블에 접근한다.

## 5. Vercel 연결 및 환경변수 입력

### 5-1. 저장소 연결

1. Vercel에서 이 GitHub 저장소를 Import한다. 이미 연결되어 있으면 기존 프로젝트를 사용한다.
2. Root Directory는 저장소 루트로 둔다.
3. 별도의 빌드 명령은 필요하지 않다. 루트 index.html은 정적 페이지로 제공되고 api/ 아래 JavaScript 파일은 Vercel Function으로 처리된다.
4. Neon Marketplace 연동을 사용했다면 환경변수 이름이 DATABASE_URL인지 확인한다. 다른 이름으로 생성됐으면 이 프로젝트가 읽는 이름인 DATABASE_URL로 추가한다.

### 5-2. 환경변수 표

Vercel Project Settings → Environment Variables에서 Preview와 Production에 필요한 값을 각각 입력한다.

| 변수 | 입력값 |
| --- | --- |
| DATABASE_URL | Neon PostgreSQL connection string 전체 |
| PUBLIC_ORIGIN | 실제 서비스 origin. 예: https://aleph-first-homework.vercel.app |
| WEBAUTHN_RP_ID | origin의 hostname만 입력. 예: aleph-first-homework.vercel.app |
| WEBAUTHN_RP_NAME | 브라우저 인증창에 표시할 이름. 예: AI Engineer Portfolio private space |
| WEBAUTHN_CHALLENGE_TTL_SECONDS | 300 |
| SESSION_TTL_SECONDS | 28800 |

Production 예시:

~~~text
PUBLIC_ORIGIN=https://aleph-first-homework.vercel.app
WEBAUTHN_RP_ID=aleph-first-homework.vercel.app
WEBAUTHN_RP_NAME=AI Engineer Portfolio private space
WEBAUTHN_CHALLENGE_TTL_SECONDS=300
SESSION_TTL_SECONDS=28800
DATABASE_URL=여기에_실제_Neon_연결문자열
~~~

### 5-3. origin과 RP ID 규칙

- PUBLIC_ORIGIN은 https://를 포함한 origin이다.
- WEBAUTHN_RP_ID는 https://와 경로를 제외한 hostname이다.
- 두 값의 hostname이 다르면 WebAuthn 검증이 실패한다.
- Preview에서 passkey를 시험하면 Preview hostname과 일치하는 환경변수로 배포해야 한다.
- Preview URL이 매번 바뀌는 경우에는 Production 도메인 또는 고정된 테스트 도메인에서 시험하는 편이 안전하다.

DATABASE_URL을 NEXT_PUBLIC_*와 같은 브라우저 노출 변수로 만들지 않는다.

## 6. 배포하기

1. Vercel 환경변수를 저장한다.
2. Deployments에서 새 배포를 실행하거나 GitHub에 새 커밋을 push한다.
3. 배포 상태가 Ready가 될 때까지 기다린다.
4. 배포된 URL을 열어 public portfolio가 표시되는지 확인한다.
5. 환경변수를 추가하거나 수정했다면 반드시 새 배포에서 반영됐는지 확인한다.

## 7. 배포 직후 기본 점검

### 7-1. public page

로그인하지 않은 새 브라우저에서 다음을 확인한다.

- 기존 public portfolio가 보인다.
- PUBLIC / PRIVATE BOUNDARY 영역이 보인다.
- private record의 실제 제목·내용이 초기 HTML에 보이지 않는다.
- 비밀번호 입력창을 사용하지 않는다.

### 7-2. 로그인 없는 private API

공개적으로 접근 가능한 Production URL에서 실행한다.

~~~bash
curl -i https://YOUR_DOMAIN/api/private/items
~~~

기대 결과:

~~~json
{
  "error": "패스키 인증이 필요합니다.",
  "code": "authentication_required"
}
~~~

HTTP 상태는 401이어야 하며 private record가 응답에 포함되면 안 된다.

## 8. 실제 passkey 등록·로그인 순서

실제 기기 또는 플랫폼 authenticator가 필요하다. WebAuthn은 HTTPS 또는 localhost에서만 동작한다.

### 8-1. sample-a 첫 등록

1. 배포 URL을 연다.
2. 공개 별칭에 sample-a를 입력한다.
3. 표시 이름에는 Sample Account A를 입력한다.
4. passkey nickname에는 주 사용 기기를 입력한다.
5. 등록 버튼을 누른다.
6. 브라우저·휴대전화·보안 키의 인증 안내를 완료한다.
7. 등록 성공 후 private records가 3개 이상 표시되는지 확인한다.
8. Passkey list에 등록한 nickname과 생성일이 표시되는지 확인한다.

첫 등록이 성공하면 서버는 account, passkey public key, private seed record를 생성한다. private key 자체는 서버로 전송되지 않는다.

### 8-2. 두 번째 passkey 추가

1. sample-a로 로그인된 상태를 유지한다.
2. 추가 passkey 등록 UI에서 nickname을 보조 기기로 입력한다.
3. 다른 기기 또는 다른 authenticator로 등록한다.
4. Passkey list에 두 개가 보이는지 확인한다.

### 8-3. 로그아웃·재로그인

1. 로그아웃 버튼을 누른다.
2. private records와 인증 전용 목록이 잠기는지 확인한다.
3. sample-a로 passkey 로그인을 시작한다.
4. 등록된 authenticator를 사용한다.
5. 로그인 성공 후 같은 계정의 private records만 다시 표시되는지 확인한다.

### 8-4. sample-b 계정 분리

1. 로그아웃한다.
2. sample-b로 첫 passkey를 등록한다.
3. sample-b의 private records를 확인한다.
4. sample-a와 sample-b의 synthetic content가 서로 다른지 확인한다.
5. 각 계정의 passkey 목록이 서로 섞이지 않는지 확인한다.

## 9. 보안 거부 동작 시험

### 9-1. 다른 계정 접근

계정 ID는 로그인 후 브라우저 개발자 도구 Console에서 확인할 수 있다.

~~~js
await fetch('/api/session', { credentials: 'include' }).then((r) => r.json())
~~~

1. sample-b로 로그인해 sample-b의 account.id를 별도로 기록한다.
2. sample-a로 다시 로그인한다.
3. sample-b의 ID를 URL에 넣어 다음 요청을 보낸다.

~~~js
await fetch('/api/private/accounts/SAMPLE_B_ACCOUNT_ID/items', {
  credentials: 'include'
}).then(async (r) => ({ status: r.status, body: await r.json() }))
~~~

4. 기대 결과는 HTTP 403, code account_scope_mismatch다.
5. sample-b의 private content가 응답에 포함되면 안 된다.
6. 반대 방향도 동일하게 시험한다.

### 9-2. challenge replay

1. DevTools Network 탭에서 auth-options와 auth-verify 요청을 확인한다.
2. 정상 passkey 로그인으로 첫 auth-verify 요청을 성공시킨다.
3. 첫 auth-verify 요청을 Copy as cURL로 복사한다.
4. 같은 요청을 다시 실행한다.
5. 기대 결과는 HTTP 401, code challenge_rejected다.
6. /api/security/events에서 challenge_rejected와 짧은 fingerprint가 기록됐는지 확인한다.

두 번째 요청이 성공하면 challenge가 원자적으로 소비되지 않은 것이므로 제출 전에 원인을 확인해야 한다.

### 9-3. passkey 삭제

1. 한 계정에 passkey 두 개를 등록한다.
2. 하나를 삭제한다.
3. 목록에 하나만 남는지 확인한다.
4. 남은 passkey로 로그인되는지 확인한다.
5. 삭제된 authenticator를 강제로 선택할 수 있는 환경이면 삭제된 credential 로그인도 시험한다.
6. 기대 결과는 credential_not_registered 또는 서명 검증 실패에 따른 HTTP 401이다.
7. 마지막 passkey를 삭제하면 모든 세션이 폐기되고 현재 세션도 종료된다.

## 10. 보안 이벤트 확인

로그인된 상태에서 실행한다.

~~~js
await fetch('/api/security/events', { credentials: 'include' }).then((r) => r.json())
~~~

응답에는 다음 정보만 있어야 한다.

- event type
- success
- reason code
- 짧은 challenge fingerprint
- 짧은 credential fingerprint
- created_at

session token, WebAuthn signature, private key, 전체 credential material이 응답에 나오면 안 된다.

## 11. 제출 증거 작성

docs/T08_EVIDENCE_TEMPLATE.md를 복사하거나 직접 열어 다음 내용을 채운다.

1. 배포 URL
2. 테스트 날짜
3. 브라우저와 OS
4. 사용한 authenticator
5. Production 또는 Preview origin
6. sample-a/sample-b 결과
7. 로그인 없는 private 요청의 401 캡처
8. 다른 accountId 요청의 403 캡처
9. challenge replay의 두 번째 401 캡처
10. 삭제한 passkey 거부 또는 삭제 후 목록 캡처
11. security events 응답 캡처

각 항목은 기대 결과만 쓰지 말고 실제 HTTP status, response code, 화면 또는 Network 캡처를 함께 남긴다.

## 12. 문제 해결표

| 증상 | 우선 확인할 것 |
| --- | --- |
| API가 server_error를 반환함 | Vercel에 DATABASE_URL이 있고 새 배포에 반영됐는지 확인 |
| 테이블을 찾을 수 없음 | Neon SQL Editor에서 migration 전체를 실행했는지 확인 |
| passkey origin 오류 | PUBLIC_ORIGIN과 실제 접속 hostname, WEBAUTHN_RP_ID가 일치하는지 확인 |
| private 자료가 비어 있음 | 첫 passkey 등록이 성공했는지, 해당 account의 t08_private_items가 생성됐는지 확인 |
| handle_already_exists | 이미 사용한 별칭이므로 다른 synthetic handle 사용 |
| Preview API가 Vercel 로그인 화면으로 감 | Preview Protection 상태를 확인하고 Production 또는 접근 가능한 테스트 배포 사용 |
| 두 번째 passkey가 등록되지 않음 | 로그인 세션이 살아 있는지, 등록 challenge를 새로 발급했는지 확인 |
| 로그아웃 후에도 자료가 보임 | 브라우저 새로고침, cookie 삭제, /api/session의 인증 상태 확인 |

오류 로그에는 DATABASE_URL, cookie 값, WebAuthn 서명, private key를 출력하지 않는다.

## 13. 완료 기준

다음 네 묶음이 모두 충족되어야 과제 제출 준비가 끝난다.

### 코드

- npm run syntax 통과
- npm run check 전체 통과
- npm audit --omit=dev --audit-level=high 결과 확인

### 데이터베이스·배포

- Neon migration 실행 완료
- 여섯 T08 테이블 생성 및 RLS 확인
- Vercel Production 환경변수 입력 완료
- Vercel deployment Ready

### 기능

- public portfolio는 인증 없이 표시
- private records는 인증 후에만 표시
- 두 계정의 private records가 분리됨
- 두 passkey 등록·목록·로그인·삭제 동작 확인

### 거부 동작·증거

- 로그인 없는 private read: 401
- 다른 계정 접근: 403 account_scope_mismatch
- challenge replay: 401 challenge_rejected
- 삭제된 credential: 401 거부
- docs/T08_EVIDENCE_TEMPLATE.md에 실제 결과와 캡처 기록

## 공식 참고 링크

- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Neon과 Vercel 연결 방법: https://neon.com/docs/guides/vercel-connection-methods
- Vercel PostgreSQL 안내: https://vercel.com/docs/postgres
- Vercel Neon Marketplace: https://vercel.com/marketplace/neon

