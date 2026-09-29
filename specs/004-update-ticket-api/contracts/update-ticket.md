# Contract: `PATCH /api/tickets/:id`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §4(`PATCH /api/tickets/:id`)를 기준으로 하며,
구현/테스트 시 빠르게 참조하기 위한 요약이다. 최종 근거는 항상 `docs/API_SPEC.md`다
(Constitution 원칙 II).

> **참고**: ⚠️ 표시 2건(`null` 허용, JSON 형식 오류 400)은 2026-09-29에 `docs/API_SPEC.md` §4에
> 반영되었다 (research.md "문서 정리 필요 항목").

## Request

`PATCH /api/tickets/:id`

**Path Parameter**:

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

**Body** (Partial Update — 전달된 필드만 갱신, 빈 객체 `{}` 허용):

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| title | string | X | 1~200자, 공백만 불가, `null` 불가 |
| description | string \| null | X | 최대 1000자, `null`이면 비움 |
| priority | enum | X | LOW, MEDIUM, HIGH, `null` 불가 |
| plannedStartDate | date string \| null | X | YYYY-MM-DD, ⚠️ `null`이면 비움 |
| dueDate | date string \| null | X | 값이 있으면 오늘 이후, ⚠️ `null`이면 비움 |

- `status`, `position` 등 위 표에 없는 키는 무시된다(오류 아님, 값은 반영되지 않음).

## 처리 규칙

- 검증 순서: `id` → 본문 형식/값 → 존재 여부
- 전달된 필드만 갱신, 나머지는 기존 값 유지
- 성공 시 `updatedAt`을 항상 현재 시각으로 갱신 (빈 body 포함)
- 응답의 `isOverdue`는 수정 후 `dueDate`와 현재 시각으로 재계산
- 하나라도 검증 실패하면 전체 거절, 아무 필드도 반영하지 않음
- `status`, `position`, `startedAt`, `completedAt`은 변경되지 않음

## Response

### 200 OK

수정된 [공통 Ticket 스키마](../../../docs/API_SPEC.md) 단건 (`isOverdue` 포함).

```json
{
  "id": 1,
  "title": "수정된 제목",
  "description": null,
  "status": "TODO",
  "priority": "HIGH",
  "position": 1024,
  "plannedStartDate": null,
  "dueDate": "2026-10-10",
  "startedAt": null,
  "completedAt": null,
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-29T00:00:00.000Z",
  "isOverdue": false
}
```

### 400 Bad Request — ID 형식 오류

```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

### 400 Bad Request — 본문 검증 실패

| 조건 | code | field | message |
|------|------|-------|---------|
| 제목 200자 초과 | VALIDATION_ERROR | title | 제목은 200자 이내로 입력해주세요 |
| 제목 공백만 입력 | VALIDATION_ERROR | title | 제목을 입력해주세요 |
| 설명 1000자 초과 | VALIDATION_ERROR | description | 설명은 1000자 이내로 입력해주세요 |
| 잘못된 우선순위 값 | VALIDATION_ERROR | priority | 우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요 |
| 과거 종료예정일 | VALIDATION_ERROR | dueDate | 종료예정일은 오늘 이후 날짜를 선택해주세요 |
| ⚠️ 본문이 JSON이 아니거나 객체가 아님 | VALIDATION_ERROR | (없음) | 요청 본문이 올바른 JSON 형식이 아닙니다 (제안 문구) |

```json
{ "error": { "code": "VALIDATION_ERROR", "field": "title", "message": "제목을 입력해주세요" } }
```

### 404 Not Found

```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓을 수정하지 못했습니다" } }
```

> 500 메시지는 엔드포인트별로 분리하는 기존 관례(`POST`: "서버 오류가 발생했습니다", `GET` 목록:
> "티켓 목록을 불러오지 못했습니다", `GET` 상세: "티켓을 불러오지 못했습니다")를 따른 제안
> 문구다. API_SPEC.md에는 엔드포인트별 500 문구 규정이 없다.

## 테스트 매핑

| 테스트 케이스 | 검증 내용 |
|------|------|
| TC-API-004-01 | 제목만 수정, 나머지 유지, `updatedAt` 갱신 |
| TC-API-004-02 | 여러 필드 동시 수정 |
| TC-API-004-03 | `description: null`로 비우기 |
| TC-API-004-04 | `plannedStartDate: null`로 비우기 |
| TC-API-004-05 | 빈 body → 200, 값 유지, `updatedAt`만 갱신 |
| TC-API-004-06 | 공백 제목 → 400 title |
| TC-API-004-07 | 201자 제목 → 400 title |
| TC-API-004-08 | 1001자 설명 → 400 description |
| TC-API-004-09 | 잘못된 우선순위 → 400 priority |
| TC-API-004-10 | 과거 `dueDate` → 400 dueDate |
| TC-API-004-11 | 없는 id → 404 |
| TC-API-004-12 | `status`/`position` 포함 → 값 불변 |

`docs/TEST_CASES.md`에 없어 구현 단계에서 추가가 필요한 케이스(spec 근거): 잘못된 `id`(400
`INVALID_ID`), `dueDate: null`로 비우기와 `isOverdue` 재계산, 여러 필드 중 하나만 무효일 때
전체 거절, 본문이 JSON이 아닐 때 400, 서비스 예외 시 500. 테스트는
`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`에 구현하며
`/** @jest-environment node */`가 필수다(`docs/TEST_CASES.md` §3).
