<div align="center">
  <h1>🔐 Passkey Private Portfolio</h1>
  <p><strong>공개 포트폴리오와 나만의 private workspace를 하나의 서비스 경험으로.</strong></p>
  <p>비밀번호 없이 passkey로 인증하고, 인증된 계정의 자료만 안전하게 보여주는 T08 포트폴리오 서비스입니다.</p>

  <p>
    <a href="https://github.com/coding-jhj/aleph-first-homework">Repository</a>
    ·
    <a href="docs/T08_SETUP.md">설정 가이드</a>
    ·
    <a href="docs/T08_EVIDENCE_TEMPLATE.md">검증 증거 양식</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20 or newer">
    <img src="https://img.shields.io/badge/Auth-WebAuthn-5E5CE6" alt="WebAuthn">
    <img src="https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599?logo=postgresql&logoColor=111111" alt="Neon PostgreSQL">
    <img src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel">
  </p>
</div>

---

## 서비스 한눈에 보기

| 방문자 | 계정 소유자 | 서버 | 제출자 |
| --- | --- | --- | --- |
| 공개 포트폴리오를 바로 탐색 | passkey로 private 공간 진입 | 계정 범위와 서명을 검증 | 실제 허용·거부 동작을 증명 |
| 로그인 전 private 내용은 보지 못함 | private records와 passkey 목록 확인 | Neon PostgreSQL에 필요한 정보만 저장 | 화면·API·Network 증거 캡처 |

> **핵심 경험**
>
> 인증 전에는 누구나 볼 수 있는 portfolio, 인증 후에는 나만 볼 수 있는 workspace가 같은 페이지 안에서 자연스럽게 이어집니다.

## 서비스 흐름

~~~mermaid
flowchart LR
    A["Public portfolio"] --> B["WebAuthn passkey"]
    B --> C["Vercel API"]
    C --> D["Neon PostgreSQL"]
    D --> E["Private workspace"]
~~~

## 이 서비스가 해결하는 것

- **Passwordless access** — 비밀번호를 저장하거나 입력하지 않고 기기·보안 키의 passkey를 사용합니다.
- **Account isolation** — 현재 로그인 세션의 account_id로만 private 자료를 조회합니다.
- **Multi-device ready** — 한 계정에 여러 passkey를 등록하고 개별 삭제할 수 있습니다.
- **Security evidence** — 성공·실패·replay·인가 거부를 짧은 fingerprint와 reason code로 기록합니다.

## 보안 설계

| 원칙 | 구현 |
| --- | --- |
| private key 보호 | private key는 기기 또는 authenticator에 남고 서버에는 public key만 저장 |
| challenge 재사용 방지 | challenge를 만료 시간과 함께 저장하고 검증 전에 원자적으로 소비 |
| session token 보호 | cookie에는 opaque token, DB에는 SHA-256 digest만 저장 |
| 계정 범위 강제 | private query와 다른 계정 URL 모두 session.account_id 기준으로 검사 |
| 직접 DB 노출 차단 | 브라우저는 DB에 연결하지 않고 Vercel API만 호출 |
| DB 방어 계층 | T08 테이블 RLS 활성화 및 PUBLIC 직접 테이블 권한 철회 |

## 기술 스택

- **Frontend**: 기존 단일 index.html portfolio + native Web Authentication API
- **API**: Vercel Node.js Functions
- **Authentication**: WebAuthn, @simplewebauthn/server
- **Database**: Neon managed PostgreSQL
- **Database client**: @neondatabase/serverless
- **Validation**: Node.js syntax check, T08 static check, npm audit

## 빠른 시작

### 준비물

- Node.js 20 이상
- Neon PostgreSQL 프로젝트
- Vercel 프로젝트
- 실제 passkey를 사용할 HTTPS 도메인 또는 localhost 환경
- 테스트용 authenticator: Windows Hello, 휴대전화 passkey, 또는 FIDO2 보안 키

### 1. 코드 받기

~~~bash
git clone https://github.com/coding-jhj/aleph-first-homework.git
cd aleph-first-homework
npm ci
npm run syntax
npm run check
~~~

Windows PowerShell에서 npm.ps1 오류가 발생하면 다음처럼 실행합니다.

~~~powershell
npm.cmd ci
npm.cmd run syntax
npm.cmd run check
~~~

### 2. Neon 연결 문자열 준비

Neon에서 PostgreSQL connection string을 복사합니다.

~~~text
postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
~~~

이 값은 비밀번호를 포함한 server-only secret입니다. GitHub, README, 브라우저 코드, 캡처 화면에 넣지 않습니다.

### 3. 데이터베이스 초기화

다음 migration 파일 전체를 Neon SQL Editor에 붙여 넣고 실행합니다.

~~~text
db/migrations/202609090001_t08_passkey_vault.sql
~~~

로컬에서 psql을 사용할 경우:

~~~bash
psql "$DATABASE_URL" -f db/migrations/202609090001_t08_passkey_vault.sql
~~~

migration이 만드는 테이블:

~~~text
t08_accounts
t08_passkeys
t08_private_items
t08_webauthn_challenges
t08_sessions
t08_auth_events
~~~

생성 확인:

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

여섯 테이블의 rowsecurity 값이 true인지 확인합니다.

### 4. Vercel 환경변수 입력

Vercel Project Settings → Environment Variables에서 Preview와 Production 환경에 입력합니다.

| 변수 | 값 |
| --- | --- |
| DATABASE_URL | Neon PostgreSQL connection string 전체 |
| PUBLIC_ORIGIN | 실제 접속 origin. 예: https://aleph-first-homework.vercel.app |
| WEBAUTHN_RP_ID | origin의 hostname. 예: aleph-first-homework.vercel.app |
| WEBAUTHN_RP_NAME | AI Engineer Portfolio private space |
| WEBAUTHN_CHALLENGE_TTL_SECONDS | 300 |
| SESSION_TTL_SECONDS | 28800 |

규칙:

- PUBLIC_ORIGIN은 https://를 포함합니다.
- WEBAUTHN_RP_ID는 protocol과 path를 제외한 hostname만 입력합니다.
- 실제 접속 hostname과 RP ID가 다르면 WebAuthn 검증이 실패합니다.
- DATABASE_URL은 NEXT_PUBLIC_* 같은 브라우저 노출 변수로 만들지 않습니다.
- Preview URL이 계속 바뀌면 고정된 Production 또는 테스트 도메인에서 passkey를 시험합니다.

### 5. 배포

1. 환경변수를 저장합니다.
2. Vercel Deployments에서 새 배포를 실행합니다.
3. 상태가 Ready가 될 때까지 기다립니다.
4. 배포 URL에서 public portfolio가 열리는지 확인합니다.
5. 환경변수를 수정했다면 반드시 새 배포에서 반영됐는지 확인합니다.

## 첫 사용자 여정

### A. sample-a 만들기

1. 공개 별칭에 sample-a를 입력합니다.
2. 표시 이름에 Sample Account A를 입력합니다.
3. passkey 이름에 주 사용 기기를 입력합니다.
4. 등록 버튼을 누릅니다.
5. 브라우저·휴대전화·보안 키의 인증을 완료합니다.
6. private records 3개 이상과 Passkey list가 나타나는지 확인합니다.

첫 등록이 끝나면 account, passkey public key, synthetic private records가 생성됩니다.

### B. 두 번째 기기 연결

1. sample-a로 로그인된 상태를 유지합니다.
2. 추가 passkey 이름에 보조 기기를 입력합니다.
3. 다른 authenticator로 등록합니다.
4. Passkey list에 2개가 표시되는지 확인합니다.

### C. 로그아웃과 재로그인

1. 로그아웃합니다.
2. private workspace가 잠기는지 확인합니다.
3. sample-a로 다시 passkey 로그인합니다.
4. 같은 계정의 private records가 다시 표시되는지 확인합니다.

### D. sample-b 격리 확인

1. 로그아웃합니다.
2. sample-b로 첫 passkey를 등록합니다.
3. sample-b의 private records를 확인합니다.
4. sample-a와 sample-b의 자료가 서로 다른지 확인합니다.
5. passkey 목록이 서로 섞이지 않는지 확인합니다.

## 검증 시나리오

### 1. 로그인 없는 private read

~~~bash
curl -i https://YOUR_DOMAIN/api/private/items
~~~

기대 결과는 HTTP 401과 authentication_required입니다. 응답에 private record가 포함되면 안 됩니다.

### 2. 다른 계정 접근

로그인 후 Console에서 현재 계정 ID를 확인합니다.

~~~js
await fetch('/api/session', { credentials: 'include' }).then((r) => r.json())
~~~

A 세션으로 B 계정 URL을 요청합니다.

~~~js
await fetch('/api/private/accounts/SAMPLE_B_ACCOUNT_ID/items', {
  credentials: 'include'
}).then(async (r) => ({ status: r.status, body: await r.json() }))
~~~

기대 결과:

~~~text
HTTP 403
code: account_scope_mismatch
~~~

### 3. Challenge replay

1. DevTools Network에서 auth-verify 요청을 찾습니다.
2. 정상 로그인을 한 번 성공시킵니다.
3. 첫 auth-verify 요청을 Copy as cURL로 복사합니다.
4. 동일 요청을 다시 실행합니다.
5. HTTP 401, challenge_rejected가 반환되는지 확인합니다.
6. /api/security/events에서 challenge_rejected 이벤트를 확인합니다.

### 4. Passkey 삭제

1. 한 계정에 passkey 2개를 등록합니다.
2. 하나를 삭제합니다.
3. 목록에 하나만 남는지 확인합니다.
4. 남은 passkey로 로그인합니다.
5. 가능한 환경에서는 삭제된 credential 로그인도 시도합니다.
6. 삭제된 credential은 HTTP 401로 거부되어야 합니다.

## 제출 증거

실제 결과는 [T08 증거 양식](docs/T08_EVIDENCE_TEMPLATE.md)에 기록합니다.

| 증거 | 기대 결과 |
| --- | --- |
| public page | 인증 없이 portfolio 표시 |
| private read without session | 401 authentication_required |
| 정상 passkey 로그인 | 200 및 private workspace 표시 |
| 계정 A/B 자료 분리 | 서로 다른 synthetic records |
| 다른 accountId 접근 | 403 account_scope_mismatch |
| challenge replay | 401 challenge_rejected |
| passkey 삭제 | 목록 감소 및 삭제 credential 거부 |
| security events | fingerprint와 reason code만 반환 |

기대 결과만 적지 말고 실제 HTTP status, response code, 화면 또는 Network 캡처를 함께 남깁니다.

## 저장소 지도

~~~text
.
├── index.html
├── api/
│   ├── passkeys/       # 등록·로그인·목록·삭제
│   ├── private/        # 세션 계정 범위 private API
│   ├── security/       # 보안 이벤트
│   └── _lib/           # DB·세션·WebAuthn·HTTP helper
├── db/migrations/      # PostgreSQL schema
├── docs/               # 설정·구현·증거 문서
├── scripts/            # 문법·요구사항 검사
├── package.json
└── vercel.json
~~~

## 완료 기준

### 구현

- npm run syntax 통과
- npm run check 전체 PASS
- npm audit 결과 확인
- Vercel deployment Ready

### 데이터베이스

- Neon migration 실행
- 여섯 T08 테이블 생성
- RLS 활성화 확인
- server-only DATABASE_URL 설정

### 서비스 경험

- 방문자는 public portfolio를 바로 볼 수 있음
- private records는 passkey 인증 후에만 표시
- 여러 passkey 등록과 삭제 가능
- 계정 A/B의 자료가 서로 분리됨
- 실패·replay·다른 계정 접근이 각각 401/403으로 거부됨

### 제출

- docs/T08_EVIDENCE_TEMPLATE.md 작성
- 실제 화면과 API/Network 증거 첨부
- Production URL과 테스트 환경 기록

## 제한 사항

- Neon 프로젝트 생성과 migration 실행은 배포 계정 권한이 필요합니다.
- 실제 passkey 검증은 HTTPS와 실제 authenticator가 필요합니다.
- Preview Protection이 켜져 있으면 Preview API 대신 접근 가능한 Production 또는 테스트 배포를 사용해야 합니다.
- 마지막 passkey를 삭제하면 해당 계정의 세션도 종료됩니다.
- 복구 이메일이나 관리자 강제 재등록 기능은 이 과제 범위에 포함하지 않았습니다.

## 공식 참고

- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon과 Vercel 연결 방법](https://neon.com/docs/guides/vercel-connection-methods)
- [Vercel PostgreSQL 안내](https://vercel.com/docs/postgres)
- [Vercel Neon Marketplace](https://vercel.com/marketplace/neon)

