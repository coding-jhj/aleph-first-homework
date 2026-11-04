# T08 증거 기록

배포 URL: https://aleph-first-homework.vercel.app

소스 URL: https://github.com/coding-jhj/aleph-first-homework

> **증거의 성격 (반드시 읽어 주세요)**
> 이 기록은 **Chromium의 가상 authenticator(Chrome DevTools Protocol `WebAuthn.addVirtualAuthenticator`)** 로 실제 배포 사이트에 실행한 결과입니다.
> 서버는 실제 WebAuthn 서명·origin·RP ID·challenge를 검증했고 응답도 실제 HTTP 응답이지만, **실기기(Windows Hello, 휴대전화 passkey, FIDO2 보안 키)로 한 시험은 아닙니다.**
> 실기기 검증은 아직 하지 않았습니다. 원본 응답과 실행 기록은 [`evidence/evidence.json`](evidence/evidence.json)에 있습니다.

## 준비 정보

- 테스트 날짜: 2026-11-04 (UTC)
- 브라우저/OS: Chromium (Playwright) / Linux
- 사용한 authenticator: **가상 authenticator** (ctap2 · internal · user verification, 실기기 아님)
- Production 또는 Preview origin: Production (`https://aleph-first-homework.vercel.app`)
- 데이터베이스: Supabase PostgreSQL
- 테스트 계정: `vauth-a-r2`(A), `vauth-b-r2`(B). 같은 날 첫 실행이 중간에 실패하며 만든 `vauth-sample-a`는 passkey를 되살릴 수 없어 로그인할 수 없는 상태로 DB에 남아 있습니다. 두 계정 모두 서버에 삭제 API가 없어 제가 지우지 못했으며, 필요하면 Supabase SQL Editor에서 `t08_accounts`의 해당 행을 지우면 됩니다(자식 행은 `on delete cascade`).

## 검사 1: no-login private read

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| 로그아웃 상태에서 public page 열기 | public portfolio 표시, private 실제 내용 미표시 | 통과: 초기 HTML에 private 문구(`계정별 작업 메모`) 없음, 잠긴 보안 공간 표시 | [01-locked.png](evidence/01-locked.png) |
| cookie 없이 GET /api/private/items | 401 authentication_required | 통과: `401 authentication_required` | evidence.json `C1-2` |
| 응답 body 검사 | private title/content 없음 | 통과: `items` 키 없음 | evidence.json `C1-2` |
| 로그아웃 뒤 같은 요청 | 401 | 통과: `401 authentication_required` | evidence.json `C1-3` |

## 검사 2: other-passkey / other-account

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| A로 로그인 후 A private read | A 자료만 반환 | 통과: `200`, 자료 3개(내용에 `vauth-a-r2` 표시) | [02-workspace-2-passkeys.png](evidence/02-workspace-2-passkeys.png) |
| A 세션으로 B accountId URL 요청 | 403 account_scope_mismatch, B 자료 없음 | 통과: `403 account_scope_mismatch`, `items` 키 없음 | evidence.json `C2-2` |
| B로 로그인 후 B private read | B 자료만 반환 | 통과: `200`, 자료 3개(내용에 `vauth-b-r2` 표시), A와 내용 다름 | evidence.json `C2-1` |
| B 세션으로 A accountId URL 요청 | 403 account_scope_mismatch, A 자료 없음 | 통과: `403 account_scope_mismatch`, `items` 키 없음 | evidence.json `C2-3` |
| A 세션으로 A 자신의 accountId URL 요청 | 200 | 통과: `200`, 자료 3개 | evidence.json `C2-4` |

## 검사 3: challenge replay

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| auth-options 두 번 호출 | challenge fingerprint 두 값이 서로 다름 | 통과: `2c6dc96f843e2370` / `fe2ad5484c0fb87c` | evidence.json `C3-1` |
| 정상 assertion 첫 요청 | 200, session cookie 설정 | 통과: `200`, `Set-Cookie: t08_session` 설정 | evidence.json `C3-2` |
| 같은 flow/assertion 재전송 | 401 challenge_rejected | 통과: `401 challenge_rejected` | evidence.json `C3-3` |
| security events 조회 | challenge_rejected와 fingerprint 기록 | 통과: `challenge_rejected / challenge_replay_or_expired`(denied)와 fingerprint 기록, 이벤트 필드는 6개뿐이고 비밀값 없음 | [03-security-events.png](evidence/03-security-events.png), evidence.json `C3-4r` |

## 검사 4: deleted-passkey login

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| 한 계정에 passkey 2개 등록 | 목록에 nickname/date 2개 표시 | 통과: `virtual-device-1`, `virtual-device-2` 2개 | [02-workspace-2-passkeys.png](evidence/02-workspace-2-passkeys.png) |
| 첫 passkey 삭제 | 남은 passkey 1개, 자료 count unchanged | 통과: 2개 → 1개(`virtual-device-2`), 자료 3개 유지 | evidence.json `C4-2` |
| 남은 passkey 로그인 | 200 및 private 자료 접근 | 통과: `200`, 자료 3개 | evidence.json `C4-3` |
| 삭제한 passkey 로그인 | 401, private 자료 없음, 실패 event 기록 | 통과: 삭제한 credential의 assertion을 서버에 직접 제출해 `401 credential_not_registered`, 이후 private read `401`, `authentication_failed / credential_not_registered` 이벤트 기록 | evidence.json `C4-4`, `C3-4r` |

> 삭제한 passkey 시험은 브라우저가 서버의 `allowCredentials`(삭제된 credential 제외)를 따르면 서명 자체를 만들 수 없으므로, 서버가 준 challenge에 삭제한 credential로 서명한 assertion을 `auth-verify`에 직접 제출하는 방식으로 했습니다.

## 정정 기록

- `evidence.json`의 `C3-4`는 응답 전체 JSON에서 `signature` 같은 단어를 찾는 검사가 응답의 설명 문구("signatures ... never returned")에 걸려 `secretLeak=true`로 실패 처리되었습니다. 이는 검사 방식의 오탐이었고, 이벤트 배열만 검사한 `C3-4r`이 이 기록을 대체합니다(`supersedes`에 원 기록 보존).

## 아직 하지 않은 것

- 실기기(Windows Hello·휴대전화·FIDO2 보안 키) 등록과 로그인
- 모바일 브라우저와 Safari/Firefox에서의 동작
