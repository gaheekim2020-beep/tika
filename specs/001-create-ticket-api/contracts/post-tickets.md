# Contract: `POST /api/tickets`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §1(POST /api/tickets)을 그대로 채택한다.
아래는 구현/테스트 시 빠르게 참조하기 위한 요약이며, 최종 근거는 항상
`docs/API_SPEC.md`다 (Constitution 원칙 II).

## Request

`POST /api/tickets`

| 필드 | 타입 | 필수 | 제약조건 | 기본값 |
|------|------|------|----------|--------|
| title | string | O | 1~200자, 공백만 불가 | - |
| description | string \| null | X | 최대 1000자 | null |
| priority | enum | X | LOW, MEDIUM, HIGH | MEDIUM |
| plannedStartDate | date string | X | ISO 8601 | null |
| dueDate | date string | X | 오늘 이후 날짜 | null |

## 처리 규칙

- `status`는 항상 `BACKLOG`
- `position` = BACKLOG 칼럼 최솟값 - 1024 (없으면 1024)
- `createdAt`, `updatedAt`은 현재 시각으로 자동 설정

## Response

### 201 Created

```json
{
  "id": 1,
  "title": "string",
  "description": null,
  "status": "BACKLOG",
  "priority": "MEDIUM",
  "position": 1024,
  "plannedStartDate": null,
  "dueDate": null,
  "startedAt": null,
  "completedAt": null,
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T00:00:00.000Z",
  "isOverdue": false
}
```

### 400 Bad Request

| 조건 | code | field | message |
|------|------|------|---------|
| 제목 누락/공백만 입력 | VALIDATION_ERROR | title | 제목을 입력해주세요 |
| 제목 200자 초과 | VALIDATION_ERROR | title | 제목은 200자 이내로 입력해주세요 |
| 설명 1000자 초과 | VALIDATION_ERROR | description | 설명은 1000자 이내로 입력해주세요 |
| 잘못된 우선순위 값 | VALIDATION_ERROR | priority | 우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요 |
| 과거 종료예정일 | VALIDATION_ERROR | dueDate | 종료예정일은 오늘 이후 날짜를 선택해주세요 |

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다" } }
```

## 테스트 매핑

이 계약을 검증하는 테스트 케이스는 `docs/TEST_CASES.md`의 `TC-API-001-01`~`TC-API-001-13`
(정상 6건 + 예외 7건)이며, `__tests__/api/tickets.test.ts`에 구현한다
(`/** @jest-environment node */` 필수, `docs/TEST_CASES.md` §1 참조).
