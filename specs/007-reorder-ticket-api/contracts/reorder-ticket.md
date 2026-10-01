# Contract: `PATCH /api/tickets/reorder`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §7(`PATCH /api/tickets/reorder`)을 기준으로 하며,
구현/테스트 시 빠르게 참조하기 위한 요약이다. 최종 근거는 항상 `docs/API_SPEC.md`다(Constitution
원칙 II).

> **참고**: 400 세부 응답(`ticketId`/`position`/본문 형식), 500 응답, `position` 설명은 2026-10-01에
> 사용자 승인을 받아 `docs/API_SPEC.md` §7에 반영했다(research.md "문서 정리 항목").

## Request

`PATCH /api/tickets/reorder`

**Body** (`Content-Type: application/json`):

```json
{ "ticketId": 1, "status": "TODO", "position": 1536 }
```

| 필드 | 타입 | 필수 | 제약조건 |
|------|------|------|----------|
| ticketId | number | O | 양의 정수 |
| status | enum | O | `BACKLOG`, `TODO`, `IN_PROGRESS`만 허용 (`DONE` 불가) |
| position | number | O | 정수(32비트 범위). 클라이언트가 규칙(FR-004)대로 계산한 최종 순서값 |

정의되지 않은 키는 무시된다.

## 처리 규칙

- 검증 순서: 본문 JSON 파싱 → 본문 스키마(`ticketId`, `status`, `position`) → 티켓 존재 여부
- `position`은 그대로 저장한다. 이동 티켓을 제외한 대상 칼럼에 **같은 값**이 있으면 그 칼럼을
  `1024, 2048, …`로 재정렬하고 이동 티켓을 겹친 티켓보다 앞에 놓는다. 다른 칼럼은 건드리지 않는다.
- `status`/`position`(및 시각 필드)은 하나의 트랜잭션으로 반영한다. 일부만 반영되지 않는다.
- 시각 규칙: `TODO`/`IN_PROGRESS`로 이동하며 `startedAt`이 `null`이면 현재 시각, `BACKLOG`로 이동(어느 칼럼에서든)하면
  `startedAt = null`, `DONE`에서 나오면 `completedAt = null`. 상세는 data-model.md.
- 제목·설명·우선순위·예정일·종료예정일은 변경하지 않는다.

## Response

### 200 OK

`GET /api/tickets`와 같은 형식의 보드 전체. 24시간이 지난 `DONE` 티켓은 제외된다.

```json
{
  "BACKLOG": [ { "...TicketWithMeta" } ],
  "TODO": [ { "...TicketWithMeta" } ],
  "IN_PROGRESS": [ { "...TicketWithMeta" } ],
  "DONE": [ { "...TicketWithMeta" } ]
}
```

### 400 Bad Request — `status` 오류 (DONE 포함)

`error.field`는 **생략**한다(API_SPEC §7 예시, TC-API-COMMON-03).

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" } }
```

### 400 Bad Request — `ticketId` / `position` 오류

```json
{ "error": { "code": "VALIDATION_ERROR", "field": "ticketId", "message": "유효하지 않은 티켓 ID입니다" } }
```

```json
{ "error": { "code": "VALIDATION_ERROR", "field": "position", "message": "위치는 -2147483648 이상 2147483647 이하의 정수로 입력해주세요" } }
```

### 400 Bad Request — 본문이 JSON이 아니거나 객체가 아님

`field` 없음. `PATCH /api/tickets/:id`(004)와 동일한 문구.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "요청 본문이 올바른 JSON 형식이 아닙니다" } }
```

### 404 Not Found

```json
{ "error": { "code": "TICKET_NOT_FOUND", "message": "존재하지 않거나 삭제된 티켓입니다" } }
```

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓 순서를 변경하지 못했습니다" } }
```

> 500 메시지는 엔드포인트별로 분리하는 기존 관례(수정: "티켓을 수정하지 못했습니다", 완료: "티켓을 완료
> 처리하지 못했습니다", 삭제: "티켓을 삭제하지 못했습니다")를 따른 문구다.

## 테스트 매핑

`docs/TEST_CASES.md` §2.7에 정의된 케이스:

| 테스트 케이스 | 검증 내용 |
|------|------|
| TC-API-007-01 | 같은 칼럼, 두 카드 사이 (`1536`) → 200, 요청값 그대로 저장 |
| TC-API-007-02 | 칼럼 맨 앞 (`첫 카드 − 1024`) → 200, 첫 번째 위치 |
| TC-API-007-03 | 칼럼 맨 뒤 (`마지막 카드 + 1024`) → 200, 마지막 위치 |
| TC-API-007-04 | 요청값이 기존 카드와 같음(`prev=next` 또는 올림한 값이 `next`와 같음) → 200, 칼럼 전체 1024 간격 재정렬, 이동 티켓이 겹친 카드 앞(= `prev`와 `next` 사이) |
| TC-API-007-05 | `BACKLOG` → `TODO`, `startedAt = null` → 현재 시각 |
| TC-API-007-06 | `BACKLOG` → `IN_PROGRESS` 직접 이동, `startedAt` 현재 시각 |
| TC-API-007-07 | `startedAt`이 이미 있는 티켓의 `TODO` ↔ `IN_PROGRESS` → 값 유지 |
| TC-API-007-08 | `TODO` → `BACKLOG`, `startedAt = null` |
| TC-API-007-25 | `IN_PROGRESS`·`DONE` → `BACKLOG`, `startedAt = null` |
| TC-API-007-09 | `DONE` → 다른 칼럼, `completedAt = null` |
| TC-API-007-10 | `DONE`이 아닌 칼럼 간 이동, `completedAt` 계속 `null` |
| TC-API-007-11 | `status = "DONE"` → 400, "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" |
| TC-API-007-12 | `status = "ARCHIVED"` → 400 `VALIDATION_ERROR` |
| TC-API-007-13 | `ticketId = 999999` → 404, "존재하지 않거나 삭제된 티켓입니다" |
| TC-API-007-14 | 재정렬 도중 실패 주입 → 전체 롤백, 어느 쪽도 반영되지 않음 (research.md "검증 방법") |

**spec에서 파생해 TEST_CASES.md §2.7에 추가한 케이스** (2026-10-01 승인):

| 테스트 케이스 | 검증 내용 | 근거 |
|------|------|------|
| TC-API-007-15 | `ticketId`가 0·음수·문자열·누락 → 400, `field="ticketId"` | FR-010 |
| TC-API-007-16 | `position`이 누락·문자열·소수·범위 초과 → 400, `field="position"` | FR-010 |
| TC-API-007-17 | 본문이 JSON이 아니거나 `[]` → 400, `field` 없음 | FR-010 |
| TC-API-007-18 | `status` 누락 → 400 (field 없음) | FR-002, FR-010 |
| TC-API-007-19 | 같은 칼럼의 같은 위치로 이동 → 200, 배치 불변 | spec 엣지 케이스 |
| TC-API-007-20 | 빈 칼럼으로 이동 → 200, 유일한 항목, 요청값 저장 | spec 엣지 케이스 |
| TC-API-007-21 | 이동 후 제목·설명·우선순위·예정일·종료예정일 불변, 본문의 다른 키 무시 | FR-011 |
| TC-API-007-22 | 서비스 예외 → 500 `INTERNAL_ERROR`, "티켓 순서를 변경하지 못했습니다" | FR-012 |
| TC-API-007-23 | 응답이 `GET /api/tickets`와 같은 4키 형식, 24시간 지난 DONE 제외 | FR-008 |
| TC-API-007-24 | 24시간 지나 보드에서 숨겨진 `DONE` 티켓도 이동 가능, `completedAt = null` | spec 엣지 케이스 |
| TC-API-007-25 | `IN_PROGRESS`·`DONE` → `BACKLOG`, `startedAt = null` | FR-006 |
| TC-API-007-26 | 충돌 재정렬이 다른 칼럼의 `position`을 바꾸지 않음 | FR-005 |

테스트는 `__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`에 구현하며
`/** @jest-environment node */`가 필수다(`docs/TEST_CASES.md` §3).
