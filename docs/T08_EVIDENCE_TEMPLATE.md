# T08 증거 캡처 양식

배포 URL: https://aleph-first-homework.vercel.app

소스 URL: https://github.com/coding-jhj/aleph-first-homework

## 준비 정보

- 테스트 날짜:
- 브라우저/OS:
- 사용한 authenticator:
- Production 또는 Preview origin:
- 데이터베이스: Neon PostgreSQL
- 테스트 계정: sample-a / sample-b

## 검사 1: no-login private read

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| 로그아웃 상태에서 public page 열기 | public portfolio 표시, private 실제 내용 미표시 |  |  |
| cookie 없이 GET /api/private/items | 401 authentication_required |  |  |
| 응답 body 검사 | private title/content 없음 |  |  |

## 검사 2: other-passkey / other-account

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| A로 로그인 후 A private read | A 자료만 반환 |  |  |
| A 세션으로 B accountId URL 요청 | 403 account_scope_mismatch, B 자료 없음 |  |  |
| B로 로그인 후 B private read | B 자료만 반환 |  |  |
| B 세션으로 A accountId URL 요청 | 403 account_scope_mismatch, A 자료 없음 |  |  |

## 검사 3: challenge replay

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| auth-options 두 번 호출 | challenge fingerprint 두 값이 서로 다름 |  |  |
| 정상 assertion 첫 요청 | 200, session cookie 설정 |  |  |
| 같은 flow/assertion 재전송 | 401 challenge_rejected |  |  |
| security events 조회 | challenge_rejected와 fingerprint 기록 |  |  |

## 검사 4: deleted-passkey login

| 단계 | 기대 결과 | 실제 결과 | 캡처/응답 |
| --- | --- | --- | --- |
| 한 계정에 passkey 2개 등록 | 목록에 nickname/date 2개 표시 |  |  |
| 첫 passkey 삭제 | 남은 passkey 1개, 자료 count unchanged |  |  |
| 남은 passkey 로그인 | 200 및 private 자료 접근 |  |  |
| 삭제한 passkey 로그인 | 401, private 자료 없음, 실패 event 기록 |  |  |
