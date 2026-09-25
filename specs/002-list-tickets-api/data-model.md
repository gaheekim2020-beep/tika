# Data Model: 티켓 목록 조회 API (보드)

이 기능은 새 DB 스키마나 새 애플리케이션 타입을 도입하지 않는다. `tickets` 테이블
전체 정의는 `docs/DATA_MODEL.md` §2~3과 `src/server/db/schema.ts`(이미 구현됨)를,
API 계약 타입은 `src/shared/types/index.ts`(이미 구현됨)를 단일 진실 공급원으로 한다.
이 문서는 이번 기능이 그 기존 타입들을 어떻게 조합해 사용하는지만 정리한다.

## 사용하는 기존 타입 (`src/shared/types/index.ts`)

```typescript
// 이미 구현됨 — 이번 기능에서 신규 추가 없음
export type BoardData = Record<TicketStatus, TicketWithMeta[]>;
export const COLUMN_ORDER: TicketStatus[] = [BACKLOG, TODO, IN_PROGRESS, DONE];
```

`GET /api/tickets`의 응답 타입은 `BoardData` 그대로다 — `TicketWithMeta`(= `Ticket` +
`isOverdue`)의 배열을 4개 상태 키로 묶은 구조.

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function getBoardData(): Promise<BoardData>
```

**책임**:
1. `tickets` 테이블 전체를 `status` → `position` 오름차순으로 정렬해 조회 (Drizzle,
   `idx_tickets_status_position` 인덱스 활용)
2. `COLUMN_ORDER` 기준으로 4개 상태 그룹으로 분류 (research.md "그룹화" 결정)
3. `DONE` 그룹에 한해 `completedAt`이 현재 시각으로부터 24시간 이내인 행만 남기고 제외
   (research.md "24시간 필터" 결정, DATA_MODEL.md §5.4)
4. 각 행에 기존 `calculateIsOverdue(status, dueDate)` 헬퍼로 `isOverdue`를 계산해
   `TicketWithMeta`로 변환 (DATA_MODEL.md §5.3, `001-create-ticket-api`에서 이미 구현됨)
5. `BoardData` 형태로 반환 — 티켓이 없는 상태는 빈 배열로 채워진 객체 반환 (오류 아님)

**에러**: DB 오류는 그대로 throw하고, Route Handler가 `INTERNAL_ERROR`(500)로 변환한다
(서비스 레이어는 HTTP 상태 코드를 알 필요가 없다 — Constitution 원칙 V, `001-create-ticket-api`와
동일 패턴).

## Route Handler (`app/api/tickets/route.ts`)

**책임** (Constitution 원칙 V: 얇게 유지, 기존 `POST` 핸들러 옆에 `GET` 추가):
1. 요청 파라미터 없음 — 파싱/검증 단계 자체가 없음
2. `ticketService.getBoardData()` 호출
3. 성공 시 200 + `BoardData` 반환
4. 예기치 못한 예외는 catch하여 `INTERNAL_ERROR`(500) 응답 (메시지는 POST와 다름 —
   contracts/get-tickets.md 참조)
