# Data Model: 티켓 생성 API

이 기능은 새 DB 스키마를 도입하지 않는다. `tickets` 테이블 전체 정의는
`docs/DATA_MODEL.md` §2~3과 `src/server/db/schema.ts`(이미 구현됨)를 단일 진실
공급원으로 한다. 이 문서는 이번 기능에서 다루는 애플리케이션 레벨 타입/함수 시그니처만
정리한다.

## 애플리케이션 타입 (`src/shared/types/index.ts`)

```typescript
// docs/DATA_MODEL.md §4와 동일 — 이번 기능에서 신규 추가
export interface CreateTicketInput {
  title: string;
  description?: string;
  priority?: TicketPriority;       // 기본값 MEDIUM은 Zod 스키마에서 적용
  plannedStartDate?: string;       // YYYY-MM-DD
  dueDate?: string;                // YYYY-MM-DD
}
```

`Ticket`, `TicketWithMeta`, `TICKET_STATUS`, `TICKET_PRIORITY`는 DATA_MODEL.md §4에
이미 설계되어 있으나 아직 코드로 구현되지 않았다 — 이번 기능 구현 시 함께 작성한다
(`/speckit-tasks`에서 순서 확정).

## Zod 스키마 (`src/shared/validations/ticket.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
export const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  plannedStartDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
}).refine(
  (data) => !data.dueDate || new Date(data.dueDate) >= startOfToday(),
  { message: "종료예정일은 오늘 이후 날짜를 선택해주세요", path: ["dueDate"] }
);

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

`title`의 "공백만 입력 불가"는 `.trim()` 후 `.min(1)`으로 처리한다. `dueDate` 과거 날짜
거부는 `.refine()`으로 처리한다 (API_SPEC.md §1 400 에러 표의 "과거 종료예정일" 케이스).

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처
async function createTicket(input: CreateTicketInput): Promise<TicketWithMeta>
```

**책임**:
1. `tickets` 테이블에서 `status = 'BACKLOG'`인 행 중 `position` 최솟값 조회
2. 신규 `position` 계산: 기존 행이 있으면 `최솟값 - 1024`, 없으면 `1024` (DATA_MODEL.md §5.5)
3. `status: 'BACKLOG'`, 계산된 `position`, 입력값으로 Drizzle `insert` 실행 (`createdAt`/`updatedAt`은 스키마 `defaultNow()`가 자동 처리)
4. 삽입된 row에 `isOverdue` 파생 필드 계산 (DATA_MODEL.md §5.3: `status !== 'DONE' && dueDate != null && dueDate < now` — 생성 직후이므로 사실상 항상 `false`, 단 로직은 재사용 가능하게 공통 헬퍼로 분리)
5. `TicketWithMeta` 형태로 반환

**에러**: DB 오류는 그대로 throw하고, Route Handler가 `INTERNAL_ERROR`(500)로 변환한다
(서비스 레이어는 HTTP 상태 코드를 알 필요가 없다 — Constitution 원칙 V).

## Route Handler (`app/api/tickets/route.ts`)

**책임** (Constitution 원칙 V: 얇게 유지):
1. `request.json()`으로 body 파싱
2. `createTicketSchema.safeParse()`로 검증 — 실패 시 `VALIDATION_ERROR`(400)와 `field` 매핑 후 즉시 응답
3. `ticketService.createTicket()` 호출
4. 성공 시 201 + 생성된 `TicketWithMeta` 반환
5. 예기치 못한 예외는 catch하여 `INTERNAL_ERROR`(500) 응답
