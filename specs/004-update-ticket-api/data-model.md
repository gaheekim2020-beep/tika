# Data Model: 티켓 수정 API

이 기능은 새 DB 스키마나 새 응답 타입을 도입하지 않는다. `tickets` 테이블 정의는
`docs/DATA_MODEL.md`와 `src/server/db/schema.ts`(이미 구현됨)를, API 계약 타입은
`src/shared/types/index.ts`(이미 구현됨)를 단일 진실 공급원으로 한다. 이 문서는 이번 기능이
기존 타입을 어떻게 조합하는지와 신규 검증 스키마·서비스 함수의 책임을 정리한다.

## 사용하는 기존 타입 (`src/shared/types/index.ts`)

```typescript
// 이미 구현됨 — 이번 기능에서 신규 추가/변경 없음
export interface UpdateTicketInput {
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  plannedStartDate?: string | null;
  dueDate?: string | null;
}
export interface TicketWithMeta extends Ticket { isOverdue: boolean }
```

- 요청 본문 타입은 `UpdateTicketInput`, 응답은 `TicketWithMeta` 단건이다.
- `status`, `position`, `startedAt`, `completedAt`, `id`, `createdAt`, `updatedAt`은 서버가
  계산/설정하므로 `UpdateTicketInput`에 존재하지 않는다(DATA_MODEL.md 근거).

## 필드별 수정 규칙

| 필드 | 값 없음(`undefined`) | `null` | 검증 |
|------|------|------|------|
| title | 변경 없음 | 허용 안 함 | 공백 제거 후 1~200자 |
| description | 변경 없음 | 비우기 | 최대 1000자 |
| priority | 변경 없음 | 허용 안 함 | LOW / MEDIUM / HIGH |
| plannedStartDate | 변경 없음 | 비우기 | 날짜 문자열(YYYY-MM-DD) |
| dueDate | 변경 없음 | 비우기 | 날짜 문자열, 값이 있을 때만 오늘 이후 |

- 요청에 있는 다른 키(`status`, `position` 등)는 파싱 단계에서 제거된다(research.md).
- 서비스가 자동으로 바꾸는 필드: `updatedAt`(항상), 파생 필드 `isOverdue`(응답 시 재계산).
- 절대 바뀌지 않는 필드: `status`, `position`, `startedAt`, `completedAt`, `createdAt`, `id`.

## 신규 검증 스키마 (`src/shared/validations/ticket.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
export const updateTicketSchema = z.object({
  title: /* trim, min 1, max 200 — optional, null 불가 */,
  description: /* max 1000 — optional, nullable */,
  priority: /* LOW|MEDIUM|HIGH — optional, default 없음 */,
  plannedStartDate: /* date — optional, nullable */,
  dueDate: /* date — optional, nullable, 값이 있을 때만 isTodayOrAfter */,
});
```

**책임**: 요청 본문을 검증하고 `UpdateTicketInput`과 형태가 일치하는 값을 만든다. 오류 메시지는
생성 스키마와 같은 문구를 사용한다. `.default()`는 사용하지 않는다(research.md).

경로 파라미터 `id`는 `003`에서 추가된 `ticketIdParamSchema`를 그대로 사용한다.

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function updateTicket(id: number, input: UpdateTicketInput): Promise<TicketWithMeta | null>
```

**책임**:
1. `input`에서 `undefined`가 아닌 키만 모아 SET 값을 만든다. 날짜 문자열은 `new Date(...)`로
   변환하고, `null`은 그대로 `null`(컬럼 비우기)로 둔다.
2. `updatedAt: new Date()`를 항상 SET에 포함한다(빈 입력 포함).
3. `UPDATE tickets SET ... WHERE id = ? RETURNING *`을 Drizzle로 한 번 실행한다.
4. 행이 없으면 `null` 반환 — Route Handler가 404로 변환.
5. 행이 있으면 `toTicketWithMeta(row)`로 변환해 반환한다(수정된 `dueDate` 기준 `isOverdue`).

**에러**: DB 오류는 그대로 throw하고 Route Handler가 500으로 변환한다(서비스는 HTTP 상태 코드를
모른다 — Constitution 원칙 V).

## Route Handler (`app/api/tickets/[id]/route.ts` — `PATCH` 추가)

**책임** (얇게 유지):
1. `params.id`를 `ticketIdParamSchema`로 검증 — 실패 시 400 `INVALID_ID`.
2. `request.json()` 파싱 — 실패 시 400 `VALIDATION_ERROR`(field 없음).
3. `updateTicketSchema.safeParse` — 실패 시 400 `VALIDATION_ERROR`(첫 이슈의 `field`, `message`;
   경로가 비면 `field` 생략 + 고정 메시지).
4. `updateTicket(id, parsed.data)` 호출.
5. `null`이면 404 `TICKET_NOT_FOUND`, 있으면 200 + `TicketWithMeta`.
6. 예외는 catch하여 500 `INTERNAL_ERROR`.

## 상태 전이

없음. 이 API는 `status`를 바꾸지 않는다.
