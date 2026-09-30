# Contract: `PATCH /api/tickets/:id/complete`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §5(`PATCH /api/tickets/:id/complete`)를 기준으로
하며, 구현/테스트 시 빠르게 참조하기 위한 요약이다. 최종 근거는 항상 `docs/API_SPEC.md`다
(Constitution 원칙 II).

> **참고**: 500 응답은 2026-09-29에 `docs/API_SPEC.md` §5에 반영되었다 (research.md "문서 정리
> 항목").

## Request

`PATCH /api/tickets/:id/complete`

**Path Parameter**:

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

**Body**: 없음. 본문이 있어도 무시된다(내용이나 형식이 잘못되어도 오류가 아님).

## 처리 규칙

- 검증 순서: `id` → 존재 여부
- `status = DONE`, `completedAt` = 현재 시각, `updatedAt` = 현재 시각(`completedAt`과 동일)
- `position` = Done 칼럼 최솟값 - 1024 (칼럼이 비어 있으면 `1024`) — 맨 위 배치
- 백로그·할 일·진행 중 어느 상태에서도 가능
- 이미 `DONE`인 티켓: 오류 없이 `200 OK`, `completedAt`·`position`·`updatedAt`을 포함해 어떤
  값도 변경하지 않고 현재 티켓을 그대로 반환 (멱등)
- 응답의 `isOverdue`는 항상 `false` (종료예정일이 지난 티켓 포함)
- `title`, `description`, `priority`, `plannedStartDate`, `dueDate`, `startedAt`, `createdAt`은
  변경되지 않음

## Response

### 200 OK

갱신된 [공통 Ticket 스키마](../../../docs/API_SPEC.md) 단건 (`isOverdue` 포함).

```json
{
  "id": 1,
  "title": "완료할 티켓",
  "description": null,
  "status": "DONE",
  "priority": "MEDIUM",
  "position": 0,
  "plannedStartDate": null,
  "dueDate": "2026-09-01",
  "startedAt": null,
  "completedAt": "2026-09-29T09:00:00.000Z",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-29T09:00:00.000Z",
  "isOverdue": false
}
```

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
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓을 완료 처리하지 못했습니다" } }
```

> 500 메시지는 엔드포인트별로 분리하는 기존 관례(`POST`: "서버 오류가 발생했습니다", `GET` 목록:
> "티켓 목록을 불러오지 못했습니다", `GET` 상세: "티켓을 불러오지 못했습니다", `PATCH` 수정:
> "티켓을 수정하지 못했습니다")를 따른 문구다.

## 테스트 매핑

| 테스트 케이스 | 검증 내용 |
|------|------|
| TC-API-005-01 | TODO 티켓 완료 → `status=DONE`, `completedAt`·`updatedAt` 갱신, `isOverdue=false` |
| TC-API-005-02 | IN_PROGRESS 티켓 완료 → `status=DONE`, `completedAt` 설정 |
| TC-API-005-03 | Done 칼럼이 비어 있을 때 → `position=1024` |
| TC-API-005-04 | Done 칼럼 최솟값이 1024일 때 → 새 `position < 1024` (맨 위) |
| TC-API-005-05 | `id="abc"` → 400 `INVALID_ID` |
| TC-API-005-06 | `id=999999` → 404 `TICKET_NOT_FOUND` |
| TC-API-005-07 | 이미 DONE → 200, `completedAt`·`position`·`updatedAt` 불변 |
| TC-API-008-09 | 종료예정일이 지난 티켓 완료 → `isOverdue=false` |

`docs/TEST_CASES.md`에 없어 구현 단계에서 추가가 필요한 케이스(spec 근거): 백로그 티켓 완료,
완료 후 제목·설명·우선순위·일정·`startedAt`·`createdAt` 불변, 본문(깨진 JSON 포함)이 있어도 동일
결과, 완료 직후 `GET /api/tickets`의 DONE 배열에 포함, `id`가 0·음수일 때 400, 서비스 예외 시
500. 테스트는 `__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`에
구현하며 `/** @jest-environment node */`가 필수다(`docs/TEST_CASES.md` §3).
