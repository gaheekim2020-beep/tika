# Data Model: 티켓 완료 처리 API

이 기능은 새 DB 스키마, 새 응답 타입, 새 검증 스키마를 도입하지 않는다. `tickets` 테이블 정의는
`docs/DATA_MODEL.md`와 `src/server/db/schema.ts`(이미 구현됨)를, API 계약 타입은
`src/shared/types/index.ts`(이미 구현됨)를 단일 진실 공급원으로 한다. 이 문서는 이번 기능이
기존 타입·컬럼을 어떻게 조합하는지와 신규 서비스 함수의 책임을 정리한다.

## 사용하는 기존 타입 (`src/shared/types/index.ts`)

```typescript
// 이미 구현됨 — 이번 기능에서 신규 추가/변경 없음
export const TICKET_STATUS = { BACKLOG, TODO, IN_PROGRESS, DONE } as const;
export interface TicketWithMeta extends Ticket { isOverdue: boolean }
```

- 요청 본문 타입은 없다(본문 없음). 경로 파라미터 `id`는 `003`에서 추가된
  `ticketIdParamSchema`(양의 정수)를 그대로 사용한다.
- 응답은 `TicketWithMeta` 단건이다.

## 필드별 변경 규칙

| 필드 | 완료 처리(아직 DONE 아님) | 이미 DONE인 티켓에 요청 |
|------|------|------|
| status | `DONE` | 변경 없음 |
| completedAt | 현재 시각 (JS `Date`) | 변경 없음 |
| position | Done 칼럼 최솟값 - 1024 (칼럼이 비면 1024) | 변경 없음 |
| updatedAt | 현재 시각 (`completedAt`과 같은 값) | 변경 없음 |
| startedAt | 변경 없음 | 변경 없음 |
| title, description, priority, plannedStartDate, dueDate, createdAt, id | 변경 없음 | 변경 없음 |
| isOverdue (파생) | 항상 `false` | 항상 `false` |

- 출발 상태(BACKLOG / TODO / IN_PROGRESS)에 따른 차이는 없다.
- 요청에 본문이 있어도 어떤 필드에도 영향을 주지 않는다.

## 상태 전이

```text
BACKLOG ─┐
TODO ────┼──(PATCH /complete)──▶ DONE   (completedAt = now, position = Done 최솟값 - 1024)
IN_PROGRESS ┘

DONE ──(PATCH /complete)──▶ DONE   (변경 없음, 200)
DONE ──▶ 다른 칼럼: 이 API의 범위 밖 (PATCH /api/tickets/reorder, FR-007이 completedAt = null 처리)
```

## Position 계산

| 상황 | 새 position |
|------|------|
| Done 칼럼(`status = 'DONE'` 전체 행)에 티켓이 없음 | `1024` |
| Done 칼럼에 티켓이 있음 | `min(position) - 1024` |

- 24시간이 지나 보드에서 숨겨진 DONE 행도 최솟값 계산에 포함한다(research.md).

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function getNextTopPosition(status: TicketStatus): Promise<number>   // 추출 (내부)
async function getNextBacklogPosition(): Promise<number>                   // 래퍼로 유지 (export 불변)
async function completeTicket(id: number): Promise<TicketWithMeta | null>  // 신규
```

**`getNextTopPosition(status)` 책임**: 해당 상태 행 중 `position` 최솟값을 조회해, 없으면
`1024`, 있으면 `최솟값 - 1024`를 반환한다. 기존 `getNextBacklogPosition` 본문에서 상태만
인자로 바꾼 것이다.

**`completeTicket(id)` 책임**:
1. `const now = new Date()`와 `position = await getNextTopPosition(DONE)`을 구한다.
2. `UPDATE tickets SET status='DONE', completed_at=now, position=..., updated_at=now
   WHERE id = ? AND status <> 'DONE' RETURNING *`을 Drizzle로 한 번 실행한다.
3. 반환 행이 있으면 `toTicketWithMeta(row)`로 변환해 반환한다.
4. 반환 행이 없으면 `id`로 조회한다. 행이 없으면 `null`(→ Route Handler가 404), 행이 있으면
   (이미 DONE) 변경 없이 `toTicketWithMeta(row)`를 반환한다.

**에러**: DB 오류는 그대로 throw하고 Route Handler가 500으로 변환한다(서비스는 HTTP 상태 코드를
모른다 — Constitution 원칙 V).

## Route Handler (`app/api/tickets/[id]/complete/route.ts` — 신규)

**책임** (얇게 유지):
1. `params.id`를 `ticketIdParamSchema`로 검증 — 실패 시 400 `INVALID_ID`.
2. 요청 본문은 읽지 않는다.
3. `completeTicket(id)` 호출.
4. `null`이면 404 `TICKET_NOT_FOUND`, 있으면 200 + `TicketWithMeta`.
5. 예외는 catch하여 500 `INTERNAL_ERROR`.
