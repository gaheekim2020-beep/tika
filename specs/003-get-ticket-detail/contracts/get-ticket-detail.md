# Contract: `GET /api/tickets/:id`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §3(`GET /api/tickets/:id`)을 그대로
채택한다. 아래는 구현/테스트 시 빠르게 참조하기 위한 요약이며, 최종 근거는 항상
`docs/API_SPEC.md`다 (Constitution 원칙 II).

## Request

`GET /api/tickets/:id`

**Path Parameter**:

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

## 처리 규칙

- ID가 정수가 아니거나 양의 정수가 아니면 400
- 존재하지 않거나 삭제된 티켓이면 404
- 조회 시점 기준 `isOverdue` 파생 필드 연산 포함
- 목록 조회(`GET /api/tickets`)의 "완료 후 24시간 경과 시 숨김" 규칙은 적용하지 않음 —
  완료된 지 오래된 티켓도 하드 삭제되지 않은 한 조회 가능

## Response

### 200 OK

```json
{
  "id": 1,
  "title": "...",
  "description": null,
  "status": "DONE",
  "priority": "MEDIUM",
  "position": 100,
  "plannedStartDate": null,
  "dueDate": null,
  "startedAt": null,
  "completedAt": "2026-09-01T00:00:00.000Z",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T00:00:00.000Z",
  "isOverdue": false
}
```

`docs/API_SPEC.md` §0의 공통 `Ticket` 스키마를 따르며 `isOverdue` 포함.

### 400 Bad Request

```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

### 404 Not Found

```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓을 불러오지 못했습니다" } }
```

> `GET /api/tickets`의 500 메시지("티켓 목록을 불러오지 못했습니다")와 다르다 — 단건
> 조회 전용 메시지를 사용한다 (기존 `POST`/`GET` 목록 조회의 엔드포인트별 메시지 분리
> 관례를 따름).

## 테스트 매핑

이 계약을 검증하는 테스트 케이스는 `docs/TEST_CASES.md`의 `TC-API-003-01`~`TC-API-003-06`
(정상 조회/24시간 경과 후 조회/잘못된 ID 형식/존재하지 않는 ID/삭제된 ID)이며,
`__tests__/api/tickets.test.ts`에 구현한다 (`/** @jest-environment node */` 필수,
`docs/TEST_CASES.md` §3 참조).
