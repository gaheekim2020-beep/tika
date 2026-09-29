# Data Model: 티켓 상세 조회 API

이 기능은 새 DB 스키마나 새 애플리케이션 타입을 도입하지 않는다. `tickets` 테이블
전체 정의는 `docs/DATA_MODEL.md` §2~3과 `src/server/db/schema.ts`(이미 구현됨)를,
API 계약 타입은 `src/shared/types/index.ts`(이미 구현됨)를 단일 진실 공급원으로 한다.
이 문서는 이번 기능이 그 기존 타입들을 어떻게 조합해 사용하는지, 그리고 신규 추가되는
검증 스키마를 정리한다.

## 사용하는 기존 타입 (`src/shared/types/index.ts`)

```typescript
// 이미 구현됨 — 이번 기능에서 신규 추가 없음
export type TicketWithMeta = Ticket & { isOverdue: boolean };
```

`GET /api/tickets/:id`의 응답 타입은 `TicketWithMeta` 단건 그대로다.

## 신규 검증 스키마 (`src/shared/validations/ticket.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
export const ticketIdParamSchema = z.coerce.number().int().positive();
```

**책임**: 경로 파라미터 `id`(문자열)를 양의 정수로 변환·검증한다. 실패 시 Route
Handler가 400 `INVALID_ID`로 응답한다 (research.md "id 검증" 결정).

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function getTicketById(id: number): Promise<TicketWithMeta | null>
```

**책임**:
1. `tickets` 테이블에서 `id`(PK)로 단건 조회 (Drizzle, `eq(tickets.id, id)`)
2. 행이 없으면 `null` 반환 — Route Handler가 이를 404로 변환
3. 행이 있으면 기존 `toTicketWithMeta(row)` 헬퍼로 변환해 반환. 이 과정에서 기존
   `calculateIsOverdue(status, dueDate)`가 조회 시점 `isOverdue`를 계산한다
   (DATA_MODEL.md §5.3, `001-create-ticket-api`에서 이미 구현됨)
4. `getBoardData()`와 달리 `DONE` 24시간 필터는 적용하지 않는다 (research.md "24시간
   필터 미적용" 결정)

**에러**: DB 오류는 그대로 throw하고, Route Handler가 `INTERNAL_ERROR`(500)로 변환한다
(서비스 레이어는 HTTP 상태 코드를 알 필요가 없다 — Constitution 원칙 V, 기존 패턴과
동일).

## Route Handler (`app/api/tickets/[id]/route.ts`)

**책임** (Constitution 원칙 V: 얇게 유지, 신규 파일):
1. 경로 파라미터 `id`를 `ticketIdParamSchema`로 검증 — 실패 시 400 `INVALID_ID` 반환
2. `ticketService.getTicketById(id)` 호출
3. 반환값이 `null`이면 404 `TICKET_NOT_FOUND` 반환
4. 반환값이 있으면 200 + `TicketWithMeta` 반환
5. 예기치 못한 예외는 catch하여 `INTERNAL_ERROR`(500) 응답 (메시지는
   contracts/get-ticket-detail.md 참조)
