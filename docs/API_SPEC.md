# Tika - API 명세 (API_SPEC.md)

> REQUIREMENTS.md(FR-001~008)와 DATA_MODEL.md(tickets 테이블)를 기준으로 작성한다.
> Route Handler는 `app/api/`에 위치하며, 요청 파싱 → 서비스 호출 → 응답 반환만 수행한다 (비즈니스 로직은 `src/server/services/`).

---

## 0. 공통 규칙

### Base URL
```
/api
```

### 공통 응답 형식

**성공 응답**: 리소스 데이터를 그대로 반환한다 (별도 wrapper 없음).

**에러 응답**:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "사용자에게 보여줄 메시지"
  }
}
```

### 공통 HTTP 상태 코드
| 상태 코드 | 의미 | 사용 시점 |
|------|------|------|
| 200 OK | 성공 | 조회, 수정, 상태변경 성공 |
| 201 Created | 생성 성공 | 티켓 생성 성공 |
| 204 No Content | 삭제 성공 | 티켓 삭제 성공 (본문 없음) |
| 400 Bad Request | 요청 검증 실패 | Zod 검증 실패, 잘못된 파라미터 형식 |
| 404 Not Found | 리소스 없음 | 존재하지 않거나 삭제된 티켓 |
| 500 Internal Server Error | 서버 오류 | 예상치 못한 서버/DB 오류 |

### 공통 에러 코드
| code | 의미 | 대응 상태코드 |
|------|------|------|
| VALIDATION_ERROR | 요청 본문/파라미터 검증 실패 | 400 |
| INVALID_ID | 티켓 ID 형식 오류 | 400 |
| TICKET_NOT_FOUND | 티켓이 존재하지 않거나 삭제됨 | 404 |
| INTERNAL_ERROR | 서버 내부 오류 | 500 |

### 공통 타입 (src/shared/types 참조)

**TicketStatus**: `"BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE"`
**TicketPriority**: `"LOW" | "MEDIUM" | "HIGH"`

**Ticket** (응답 공통 스키마):
```json
{
  "id": 1,
  "title": "string",
  "description": "string | null",
  "status": "BACKLOG | TODO | IN_PROGRESS | DONE",
  "priority": "LOW | MEDIUM | HIGH",
  "position": 1024,
  "plannedStartDate": "2026-09-01 | null",
  "dueDate": "2026-09-10 | null",
  "startedAt": "2026-09-01T00:00:00.000Z | null",
  "completedAt": "2026-09-01T00:00:00.000Z | null",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T00:00:00.000Z",
  "isOverdue": false
}
```
> `isOverdue`는 DB에 저장되지 않는 파생 필드로, 조회 시점에 연산되어 응답에만 포함된다 (FR-008).
> 판정 규칙: `status !== 'DONE' && dueDate가 존재 && dueDate < 현재시각` → `true`

---

## 1. `POST /api/tickets` — 티켓 생성

**관련 FR**: FR-001

### Request

**Body**:
```json
{
  "title": "string",
  "description": "string | null (optional)",
  "priority": "LOW | MEDIUM | HIGH (optional, default: MEDIUM)",
  "plannedStartDate": "ISO 8601 date (optional)",
  "dueDate": "ISO 8601 date (optional)"
}
```

| 필드 | 타입 | 필수 | 제약조건 | 기본값 |
|------|------|------|----------|--------|
| title | string | O | 1~200자, 공백만 불가 | - |
| description | string \| null | X | 최대 1000자 | null |
| priority | enum | X | LOW, MEDIUM, HIGH | MEDIUM |
| plannedStartDate | date string | X | ISO 8601 | null |
| dueDate | date string | X | 오늘 이후 날짜 | null |

### 처리 규칙
- `status`는 항상 `BACKLOG`로 생성
- `position`은 BACKLOG 칼럼 내 최솟값 - 1024 (맨 위 배치, 티켓이 없으면 1024)
- `createdAt`, `updatedAt` 자동 설정 (현재 시각)

### Response

**201 Created**
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

**400 Bad Request**
| 조건 | code | message |
|------|------|---------|
| 제목 누락/공백만 입력 | VALIDATION_ERROR | 제목을 입력해주세요 |
| 제목 200자 초과 | VALIDATION_ERROR | 제목은 200자 이내로 입력해주세요 |
| 설명 1000자 초과 | VALIDATION_ERROR | 설명은 1000자 이내로 입력해주세요 |
| 잘못된 우선순위 값 | VALIDATION_ERROR | 우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요 |
| 과거 종료예정일 | VALIDATION_ERROR | 종료예정일은 오늘 이후 날짜를 선택해주세요 |

**500 Internal Server Error**
```json
{ "error": { "code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다" } }
```

---

## 2. `GET /api/tickets` — 티켓 목록 조회 (보드)

**관련 FR**: FR-002, FR-008

### Request
파라미터 없음.

### 처리 규칙
- 전체 티켓을 조회하여 4개 상태(`BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`)별로 그룹화
- 각 컬럼 내 `position` 오름차순 정렬
- 각 티켓에 `isOverdue` 파생 필드 포함 (FR-008 규칙 적용)
- `DONE` 컬럼은 `completedAt` 기준 24시간 이내 완료된 티켓만 포함 (FR-005)

### Response

**200 OK**
```json
{
  "BACKLOG": [ { "...Ticket" } ],
  "TODO": [ { "...Ticket" } ],
  "IN_PROGRESS": [ { "...Ticket" } ],
  "DONE": [ { "...Ticket" } ]
}
```
각 배열 원소는 [공통 Ticket 스키마](#공통-타입-srcsharedtypes-참조)를 따르며 `isOverdue` 포함.

**500 Internal Server Error**
```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓 목록을 불러오지 못했습니다" } }
```

---

## 3. `GET /api/tickets/:id` — 티켓 상세 조회

**관련 FR**: FR-003

### Request

**Path Parameter**:
| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

### 처리 규칙
- ID가 정수가 아니거나 양의 정수가 아니면 400
- 존재하지 않거나 삭제된 티켓이면 404
- 조회 시점 기준 `isOverdue` 파생 필드 연산 포함

### Response

**200 OK**: [공통 Ticket 스키마](#공통-타입-srcsharedtypes-참조) 단건

**400 Bad Request**
```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

**404 Not Found**
```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

---

## 4. `PATCH /api/tickets/:id` — 티켓 수정

**관련 FR**: FR-004

### Request

**Path Parameter**:
| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

**Body** (Partial Update — 전달된 필드만 갱신):
```json
{
  "title": "string (optional)",
  "description": "string | null (optional)",
  "priority": "LOW | MEDIUM | HIGH (optional)",
  "plannedStartDate": "ISO 8601 date (optional)",
  "dueDate": "ISO 8601 date (optional)"
}
```

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| title | string | X | 1~200자, 공백만 불가 |
| description | string \| null | X | 최대 1000자 |
| priority | enum | X | LOW, MEDIUM, HIGH |
| plannedStartDate | date string | X | ISO 8601 |
| dueDate | date string | X | 오늘 이후 날짜 |

> `status`, `position` 변경은 본 API에서 처리하지 않는다 (`PATCH /api/tickets/reorder` 참조).

### 처리 규칙
- 전달된 필드만 선택적으로 업데이트
- `updatedAt`을 현재 시각으로 자동 갱신
- 응답 시 `isOverdue` 파생 필드 재연산

### Response

**200 OK**: 수정된 [공통 Ticket 스키마](#공통-타입-srcsharedtypes-참조)

**400 Bad Request**
| 조건 | code | message |
|------|------|---------|
| 제목 200자 초과 | VALIDATION_ERROR | 제목은 200자 이내로 입력해주세요 |
| 제목 공백만 입력 | VALIDATION_ERROR | 제목을 입력해주세요 |
| 설명 1000자 초과 | VALIDATION_ERROR | 설명은 1000자 이내로 입력해주세요 |
| 잘못된 우선순위 값 | VALIDATION_ERROR | 우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요 |
| 과거 종료예정일 | VALIDATION_ERROR | 종료예정일은 오늘 이후 날짜를 선택해주세요 |

**404 Not Found**
```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

---

## 5. `PATCH /api/tickets/:id/complete` — 티켓 완료 처리

**관련 FR**: FR-005

### Request

**Path Parameter**:
| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

**Body**: 없음.

### 처리 규칙
- DONE으로 이동: `status` = `DONE`, `completedAt` = 현재 시각
- DONE 이동 시 `position`은 DONE 칼럼 내 최솟값 - 1024 (맨 위 배치, 티켓이 없으면 1024)
- `updatedAt` 자동 갱신
- `status === 'DONE'`이므로 응답의 `isOverdue`는 항상 `false`
- Done 칼럼 노출은 `completedAt` 기준 24시간 이내로 제한 (목록 조회 시 적용, FR-002)

> DONE에서 다른 칼럼으로 이동 시 `completedAt = null` 처리는 `PATCH /api/tickets/reorder` (FR-007, [섹션 7](#7-patch-apiticketsreorder--상태순서-변경-드래그앤드롭))에서 수행한다. 본 API는 DONE 진입만 처리한다.

### Response

**200 OK**: 갱신된 [공통 Ticket 스키마](#공통-타입-srcsharedtypes-참조)

**400 Bad Request**
```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

**404 Not Found**
```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않는 티켓입니다" } }
```

---

## 6. `DELETE /api/tickets/:id` — 티켓 삭제

**관련 FR**: FR-006

### Request

**Path Parameter**:
| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| id | number | O | 양의 정수 |

### 처리 규칙
- Hard Delete (DB에서 완전 삭제)

### Response

**204 No Content**: 본문 없음

**400 Bad Request**
```json
{ "error": { "code": "INVALID_ID", "message": "유효하지 않은 티켓 ID입니다" } }
```

**404 Not Found**
```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않는 티켓입니다" } }
```

---

## 7. `PATCH /api/tickets/reorder` — 상태/순서 변경 (드래그앤드롭)

**관련 FR**: FR-007

### Request

**Body**:
```json
{
  "ticketId": 1,
  "status": "BACKLOG | TODO | IN_PROGRESS",
  "position": 1024
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| ticketId | number | O | 이동할 티켓 ID |
| status | enum | O | 이동 대상 칼럼 (`BACKLOG`, `TODO`, `IN_PROGRESS`만 허용, `DONE` 불가) |
| position | number | O | 칼럼 내 새 위치 |

> `DONE`으로의 이동은 이 API에서 허용하지 않는다. `PATCH /api/tickets/:id/complete` (FR-005)를 사용한다.

### 처리 규칙
- `status`와 `position`을 트랜잭션으로 원자적 업데이트
- **position 재계산 로직**:
  - 두 카드 사이 삽입: `(prev + next) / 2`
  - 간격이 1 미만이면 해당 칼럼 전체를 1024 간격으로 재정렬
  - 맨 앞 삽입: 첫 번째 카드의 position - 1024
  - 맨 뒤 삽입: 마지막 카드의 position + 1024
- **비즈니스 로직**:
  - `TODO` 또는 `IN_PROGRESS`로 이동 시, 기존 `startedAt`이 `null`이면: `startedAt` = 현재 시각 (`TODO`를 거치지 않고 `IN_PROGRESS`로 직접 이동해도 동일하게 적용, 이미 설정된 값은 덮어쓰지 않음)
  - `TODO`에서 `BACKLOG`로 이동 시: `startedAt` = `null`
  - `DONE`에서 다른 칼럼(`BACKLOG`, `TODO`, `IN_PROGRESS`)으로 이동 시: `completedAt` = `null`

### Response

**200 OK**: 업데이트된 티켓 목록 (4개 컬럼 그룹화, [`GET /api/tickets`](#2-get-apitickets--티켓-목록-조회-보드) 응답과 동일한 형식)
```json
{
  "BACKLOG": [ { "...Ticket" } ],
  "TODO": [ { "...Ticket" } ],
  "IN_PROGRESS": [ { "...Ticket" } ],
  "DONE": [ { "...Ticket" } ]
}
```

**400 Bad Request**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" } }
```

**404 Not Found**
```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "티켓을 찾을 수 없습니다" } }
```

---

## 8. 엔드포인트 요약

| Method | URL | 설명 | 관련 FR |
|--------|-----|------|---------|
| POST | `/api/tickets` | 티켓 생성 | FR-001 |
| GET | `/api/tickets` | 티켓 목록 조회 (보드, 4컬럼 그룹화) | FR-002, FR-008 |
| GET | `/api/tickets/:id` | 티켓 상세 조회 | FR-003 |
| PATCH | `/api/tickets/:id` | 티켓 수정 (Partial Update) | FR-004 |
| PATCH | `/api/tickets/:id/complete` | 티켓 완료 처리 (Done 이동) | FR-005 |
| DELETE | `/api/tickets/:id` | 티켓 삭제 (Hard Delete) | FR-006 |
| PATCH | `/api/tickets/reorder` | 상태/순서 변경 (드래그앤드롭) | FR-007 |

---
