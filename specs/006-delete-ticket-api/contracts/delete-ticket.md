# Contract: `DELETE /api/tickets/:id`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §6(`DELETE /api/tickets/:id`)을 기준으로 하며,
구현/테스트 시 빠르게 참조하기 위한 요약이다. 최종 근거는 항상 `docs/API_SPEC.md`다(Constitution
원칙 II).

> **참고**: 500 응답은 2026-09-30에 `docs/API_SPEC.md` §6에 반영되었다 (research.md "문서 정리
> 항목").

## Request

`DELETE /api/tickets/:id`

**Path Parameter**:

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

**Body**: 없음. 본문이 있어도 무시된다(내용이나 형식이 잘못되어도 오류가 아님).

## 처리 규칙

- 검증 순서: `id` → 존재 여부
- Hard Delete: DB에서 행을 완전히 제거한다 (삭제 플래그 없음)
- 백로그·할 일·진행 중·완료 어느 상태에서도 가능
- 이미 삭제된(또는 없는) id는 성공이 아니라 404
- 다른 티켓의 내용·`position`은 변경하지 않음

## Response

### 204 No Content

본문 없음.

### 400 Bad Request — ID 형식 오류

```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

### 404 Not Found

```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓을 삭제하지 못했습니다" } }
```

> 500 메시지는 엔드포인트별로 분리하는 기존 관례(`PATCH` 수정: "티켓을 수정하지 못했습니다",
> `PATCH` 완료: "티켓을 완료 처리하지 못했습니다" 등)를 따른 문구다.

## 테스트 매핑

| 테스트 케이스 | 검증 내용 |
|------|------|
| TC-API-006-01 | 존재하는 티켓 삭제 → 204, 본문 없음. 이후 동일 id 조회 시 404 |
| TC-API-006-02 | 삭제 직후 DB에 해당 row가 남아있지 않음 |
| TC-API-006-03 | `id="abc"` → 400 `INVALID_ID` |
| TC-API-006-04 | `id=999999` → 404 `TICKET_NOT_FOUND`, "존재하지 않거나 삭제된 티켓입니다" |
| TC-API-006-05 | 이미 삭제한 id 재요청 → 404 `TICKET_NOT_FOUND` |

`docs/TEST_CASES.md`에 없어 구현 단계에서 추가가 필요한 케이스(spec 근거): `id`가 0·음수일 때
400, 본문(깨진 JSON 포함)이 있어도 동일 결과, 삭제 후 다른 티켓 내용·`position` 불변, 삭제 후
`GET /api/tickets` 목록에 없음, 모든 상태(DONE 포함) 삭제, 서비스 예외 시 500. 테스트는
`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`에 구현하며
`/** @jest-environment node */`가 필수다(`docs/TEST_CASES.md` §3).
