# Tika - 데이터 모델 명세 (DATA_MODEL.md)

> 버전: 1.0 (MVP)
> ORM: Drizzle ORM + Vercel Postgres

---

## 1. ERD (Entity Relationship Diagram)

### MVP: 단일 엔티티

```
┌──────────────────────────────────────────────────┐
│                      tickets                      │
├──────────────────────────────────────────────────┤
│ id                  SERIAL       PK               │
│ title               VARCHAR(200) NOT NULL         │
│ description         TEXT         NULLABLE         │
│ status              VARCHAR(20)  NOT NULL         │
│ priority            VARCHAR(10)  NOT NULL         │
│ position            INTEGER      NOT NULL         │
│ planned_start_date  DATE         NULLABLE         │
│ due_date            DATE         NULLABLE         │
│ started_at          TIMESTAMP    NULLABLE         │
│ completed_at        TIMESTAMP    NULLABLE         │
│ created_at          TIMESTAMP    NOT NULL         │
│ updated_at          TIMESTAMP    NOT NULL         │
└──────────────────────────────────────────────────┘
```

> MVP는 단일 사용자이므로 User 테이블 없이 tickets 테이블만 사용한다.
> 2차에서 Google OAuth 도입 시 users 테이블을 추가하고 tickets에 user_id FK를 연결한다.

---

### 2차 확장 예상 ERD
```
┌──────────────┐       ┌─────────────────┐
│    users     │       │    tickets      │
├──────────────┤       ├─────────────────┤
│ id       PK  │──1:N─▶│ user_id    FK   │
│ email        │       │ id         PK   │
│ name         │       │ title           │
│ avatar_url   │       │ ...             │
│ created_at   │       └─────────────────┘
└──────────────┘
                        ┌─────────────────┐
                        │    columns      │
                        ├─────────────────┤
                        │ id         PK   │
                        │ name            │
                        │ position        │
                        │ board_id   FK   │
                        └─────────────────┘
```

> ⚠️ 추가 검토 필요: `columns.board_id`가 참조할 `boards` 테이블이 아직 다이어그램에 없음.
> 또한 `tickets`가 기존 `status`(VARCHAR) 방식에서 `columns` 참조 방식(예: `tickets.column_id FK`)으로 전환되는지,
> 두 방식이 병행되는지 관계가 명확하지 않음. 2차 스펙 논의 시 확정 필요.

---


## 2. 테이블 정의: tickets

### 칼럼 상세

| 칼럼 | 타입 | 제약조건 | 기본값 | 설명 |
|------|------|------|------|------|
| id | SERIAL | PK, auto-increment | - | 티켓 고유 식별자 |
| title | VARCHAR(200) | NOT NULL | - | 티켓 제목 |
| description | TEXT | NULLABLE | - | 티켓 상세 설명 |
| status | VARCHAR(20) | NOT NULL | 'BACKLOG' | 현재 상태 (칼럼) |
| priority | VARCHAR(10) | NOT NULL | 'MEDIUM' | 우선 순위 |
| position | INTEGER | NOT NULL | 1 | 칼럼 내 표시 순위 |
| planned_start_date | DATE | NULLABLE | NULL | 시작예정일 (사용자 입력) |
| due_date | DATE | NULLABLE | NULL | 종료예정일 (사용자 입력) |
| started_at | TIMESTAMP | NULLABLE | NULL | 시작일 (TODO 이동 시 자동 설정) |
| completed_at | TIMESTAMP | NULLABLE | NULL | 종료일 (Done 이동 시 자동 설정) |
| created_at | TIMESTAMP | NOT NULL | now() | 생성 시각 |
| updated_at | TIMESTAMP | NOT NULL | now() | 수정 시각 |

### 날짜 필드 구분
| 구분 | 필드명 | 한국어명 | DB 타입 | 런타임(JS) 타입 | 입력 주체 | 설명 |
| ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| 사용자 입력 | planned_start_date | 시작예정일 | DATE | Date 객체 | 사용자 | 티켓 생성/수정 시 사용자가 입력 |
| 사용자 입력 | due_date | 종료예정일 | DATE | Date 객체 | 사용자 | 티켓 생성/수정 시 사용자가 입력. isOverdue 판정에 직접 비교됨 |
| 시스템 자동 | started_at | 시작일 | TIMESTAMP | Date 객체 | 시스템 | TODO로 이동 시 자동 설정(PATCH /api/tickets/reorder) |
| 시스템 자동 | completed_at | 종료일 | TIMESTAMP | Date 객체 | 시스템 | Done으로 이동 시 자동 설정(PATCH /api/tickets/:id/complete) |

> 날짜/시각 필드는 서비스 레이어에서 항상 JS `Date` 객체로 다룬다 (문자열 파싱/비교 금지).
> Drizzle 스키마에서는 모든 날짜/시각 컬럼에 `{ mode: 'date' }`를 명시해 이를 보장한다 (아래 "3. Drizzle 스키마 정의" 참조).

## 칼럼 제약사항

**status 허용값**: `BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`
**priority 허용값**: `LOW`, `MEDIUM`, `HIGH`

> status, priority는 PostgreSQL ENUM 타입을 사용하지 않는다.
> DB 레벨 ENUM은 값을 추가하거나 변경할 때 마이그레이션이 복잡해지므로,
> VARCHAR + 애플리케이션 레벨 검증(Zod)으로 제약한다.

### 인덱스
| 인덱스 | 칼럼 | 용도|
|------|------|------|
| idx_tickets_status_position | (status, position) | 칼럼별 정렬 조회 (보드 렌더링) |
| idx_tickets_due_date | (due_date) | 종료예정일 기준 조회 (오버듀 필터) |
| idx_tickets_completed_at | (completed_at) | Done 칼럼 24시간 필터 |

---

## 3. Drizzle 스키마 정의

> 파일 위치: `src/server/db/schema.ts`
> 위 "테이블 정의"의 칼럼/제약조건/인덱스를 그대로 코드로 옮긴다.

```typescript
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("BACKLOG"),
    priority: varchar("priority", { length: 10 }).notNull().default("MEDIUM"),
    position: integer("position").notNull().default(1),
    plannedStartDate: date("planned_start_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_tickets_status_position").on(table.status, table.position),
    index("idx_tickets_due_date").on(table.dueDate),
    index("idx_tickets_completed_at").on(table.completedAt),
  ]
);

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
```

### 설계 노트

- **`status`, `priority`는 `varchar`**: DB 레벨 `pgEnum`을 쓰지 않고 애플리케이션 레벨(Zod, `src/shared/types`)에서 값을 제약한다 (앞의 "칼럼 제약사항" 참조). 허용값 목록(`BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE`, `LOW`/`MEDIUM`/`HIGH`)의 단일 진실 공급원(source of truth)은 `src/shared/types`의 `const` 객체이며, 이 스키마는 그 값을 그대로 저장하는 컨테이너 역할만 한다.
- **`date` vs `timestamp` 구분**: `plannedStartDate`/`dueDate`는 사용자가 입력하는 "날짜만" 있는 값이라 `date` 타입을, `startedAt`/`completedAt`/`createdAt`/`updatedAt`은 시스템이 특정 시각에 자동 기록하는 값이라 `timestamp` 타입을 사용한다. DATA_MODEL.md의 "날짜 필드 구분" 표와 1:1 대응된다.
- **모든 날짜/시각 필드에 `{ mode: 'date' }`**: Drizzle의 `date()`/`timestamp()` 기본 반환 모드는 `string`이다. `mode: 'date'`를 명시해야 조회 결과가 JS `Date` 객체로 반환되며, FR-008 오버듀 판정(`dueDate < now`)처럼 날짜를 직접 비교하는 서비스 로직에서 문자열-Date 간 변환 실수 없이 일관되게 다룰 수 있다.
- **`updatedAt`에 `$onUpdate`**: UPDATE 쿼리마다 서비스 코드에서 `updatedAt: new Date()`를 매번 명시하지 않아도, Drizzle이 해당 로우가 갱신될 때 자동으로 현재 시각을 채운다. FR-004/FR-005/FR-007의 "수정/완료/재정렬 시 updatedAt 자동 갱신" 규칙을 스키마 레벨에서 보장해 누락을 방지한다.
- **인덱스는 복합 인덱스 1개 + 단일 인덱스 2개**: `(status, position)`은 보드 조회(`GET /api/tickets`)가 항상 "칼럼별로 묶고 position 순 정렬"하는 패턴이므로 복합 인덱스로 커버한다. `due_date`, `completed_at`은 각각 오버듀 판정과 Done 24시간 필터에 단독으로 쓰이므로 별도 인덱스로 둔다.
- **`$inferSelect` / `$inferInsert`**: Drizzle이 스키마로부터 자동 추론한 DB row 타입이다(`TicketRow`/`NewTicketRow`). 이 타입은 `src/server/db/schema.ts`(백엔드 전용) 밖으로 내보내지 않는다 — `src/shared/types`의 API 계약 타입(아래 "4. TypeScript 타입 정의"의 `Ticket`)은 이 타입에서 파생시키지 않고 독립적으로 선언한다. `src/shared/types`가 Drizzle 스키마에 의존하면 프론트엔드(`src/client`)가 DB 구현에 간접 결합되어 CLAUDE.md의 프론트/백엔드 경계 규칙에 어긋나기 때문이다. 이름도 `Ticket`(shared, API 계약)과 `TicketRow`(server, DB row)로 구분한다.
- **`position` 기본값 `1`**: FR-001/FR-005의 "칼럼에 티켓이 없으면 position = 1024" 규칙은 애플리케이션(서비스 레이어)에서 계산해 명시적으로 삽입하는 값이며, 컬럼 기본값 `1`은 그 계산 로직을 거치지 않는 직접 INSERT(시드 데이터 등) 상황을 위한 안전값이다.
- **`raw SQL` 미사용**: CLAUDE.md 규칙("DB 쿼리는 Drizzle ORM으로만 작성, raw SQL 금지")에 따라 인덱스 정의도 `drizzle-orm/pg-core`의 `index()` 빌더만 사용했다.

### 마이그레이션 반영

스키마 정의 후에는 `npm run db:generate`로 마이그레이션 파일을 생성하고, `npm run db:migrate`로 실제 DB에 반영한다.

---

## 4. TypeScript 타입 정의

> 파일 위치: `src/shared/types/index.ts`
> API_SPEC.md의 요청/응답 필드를 단일 진실 공급원으로 삼아 독립적으로 선언한다 (Drizzle 스키마에서 파생시키지 않음).
> 프론트엔드(`src/client`)와 백엔드(`app/api`, `src/server`)가 이 파일을 공유해서 import한다 (CLAUDE.md 규칙).
> `src/shared/`는 `src/server/db/schema`(Drizzle, 3번 섹션)를 import하지 않는다 — DB row 타입(`TicketRow`)과 API 계약 타입(`Ticket`)을 분리해 프론트/백엔드 경계를 지킨다.

```typescript
// --- 상태 및 우선순위 ---
export const TICKET_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type TicketPriority = (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];

// --- 칼럼 순서 정의 ---
export const COLUMN_ORDER: TicketStatus[] = [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
];

export const COLUMN_LABELS: Record<TicketStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'TODO',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

// --- 티켓 타입 ---
export interface Ticket {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  position: number;
  plannedStartDate: string | null;  // ISO 8601 date (YYYY-MM-DD), 시작예정일
  dueDate: string | null;           // ISO 8601 date (YYYY-MM-DD), 종료예정일
  startedAt: Date | null;           // 시작일 (TODO 이동 시 시스템 설정)
  completedAt: Date | null;         // 종료일 (Done 이동 시 시스템 설정)
  createdAt: Date;
  updatedAt: Date;
}

// 파생 필드 포함 (보드 조회 응답용)
export interface TicketWithMeta extends Ticket {
  isOverdue: boolean;               // dueDate < today && status !== DONE
}

// --- API 요청 타입 ---

// POST /api/tickets
export interface CreateTicketInput {
  title: string;
  description?: string;
  priority?: TicketPriority;
  plannedStartDate?: string;        // YYYY-MM-DD
  dueDate?: string;                 // YYYY-MM-DD
}

// PATCH /api/tickets/:id
export interface UpdateTicketInput {
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  plannedStartDate?: string | null;
  dueDate?: string | null;
}

// PATCH /api/tickets/reorder
// DONE은 허용하지 않음 — Done 이동은 PATCH /api/tickets/:id/complete 사용
export type ReorderableStatus = Exclude<TicketStatus, typeof TICKET_STATUS.DONE>;

export interface ReorderTicketInput {
  ticketId: number;
  status: ReorderableStatus;        // BACKLOG | TODO | IN_PROGRESS (DONE 제외)
  position: number;
}

// --- 보드 데이터 구조 ---
export type BoardData = Record<TicketStatus, TicketWithMeta[]>;
```

### 설계 노트

- **DB 스키마가 아닌 API_SPEC.md를 단일 진실 공급원으로 삼음**: `Ticket`은 Drizzle의 `$inferSelect`(`TicketRow`, 3번 섹션 참조)에서 파생시키지 않고 API 응답 필드를 그대로 선언한다. `src/shared/types`가 `src/server/db/schema`를 import하면 프론트엔드가 DB 구현에 간접 결합되어 CLAUDE.md의 "src/client에서 직접 DB 접근 금지"라는 경계 규칙의 취지에 어긋나기 때문이다. DB↔API 간 필드 변환(뒤에서 설명)은 서비스 레이어가 책임진다.
- **`plannedStartDate`/`dueDate`는 `string`, `startedAt`/`completedAt`/`createdAt`/`updatedAt`은 `Date`**: DB 저장 형식과 달리, API 계약 타입에서는 두 그룹이 다르게 취급된다. 사용자가 입력/표시하는 날짜 전용 필드(`plannedStartDate`, `dueDate`)는 시각 정보가 없는 `YYYY-MM-DD` 문자열로 유지하고, 시스템이 기록하는 타임스탬프(`startedAt`, `completedAt`, `createdAt`, `updatedAt`)는 `Date`로 다룬다. 후자는 실제 JSON 응답에서는 ISO 문자열로 직렬화되므로, 프론트엔드에서 수신 시 `new Date(...)`로 파싱하는 것을 전제로 한다.
- **`enum` 대신 `const` 객체**: CLAUDE.md 컨벤션에 따라 TypeScript `enum` 대신 `as const` 객체 + `typeof` 패턴을 사용했다.
- **`COLUMN_ORDER`/`COLUMN_LABELS`**: 보드를 4칼럼으로 렌더링할 때(FR-002, US-003) 필요한 순서·라벨 상수다. 컴포넌트별 세부 UI는 COMPONENT_SPEC.md(작성 예정)에서 다루지만, `status` 값과 1:1로 묶이는 상수라 `TICKET_STATUS` 바로 옆에 두어 하나의 소스에서 관리한다.
- **`CreateTicketInput`/`UpdateTicketInput`을 API_SPEC.md 요청 필드에서 직접 선언**: DB 컬럼을 `Pick`하지 않고 API_SPEC.md의 "입력 필드" 표를 그대로 옮긴다. `status`, `position`, `startedAt`, `completedAt`, `id`, `createdAt`, `updatedAt`은 서버가 계산/설정하므로 애초에 이 타입에 존재하지 않는다(FR-001, FR-004).
- **`ReorderTicketInput.status`에서 `DONE` 제외**: FR-007 규칙("DONE은 허용하지 않는다")을 `ReorderableStatus = Exclude<TicketStatus, typeof TICKET_STATUS.DONE>` 타입으로 강제한다. `DONE` 이동은 별도 API(`/complete`)를 사용하므로 이 타입에 값이 들어올 수 없다.
- **실제 Zod 스키마와의 관계**: 이 타입들은 `src/shared/validations/ticket.ts`의 Zod 스키마(`z.infer<typeof createTicketSchema>` 등)로 대체/검증될 수 있다. 구현 단계에서는 Zod 스키마를 우선 정의하고 이 타입들을 `z.infer`로 대체하는 방식도 가능하다 — 어떤 방식을 취하든 API_SPEC.md의 요청/응답 필드와 반드시 일치해야 한다.

---

## 5. 비즈니스 규칙

> REQUIREMENTS.md(FR-001~008)에 흩어져 있는 자동화·판정 규칙 중 데이터 모델에 직접 영향을 주는 것들을 한곳에 모은다.
> 각 항목의 최종 근거는 REQUIREMENTS.md이며, 이 섹션은 데이터 관점에서 빠르게 참조하기 위한 요약이다.

### 5.1 시작 처리 자동화 (`startedAt`)

| 이동 | 처리 | 근거 |
|------|------|------|
| 어느 칼럼 → `TODO` | `startedAt` = 현재 시각 | FR-007 |
| `TODO` → `BACKLOG` | `startedAt` = `null` | FR-007 |
| 그 외 이동 | `startedAt` 변경 없음 | FR-007 |

- `startedAt`은 `PATCH /api/tickets/reorder` (FR-007)에서만 갱신된다. 생성(FR-001), 수정(FR-004), 완료(FR-005) API는 이 필드를 건드리지 않는다.
- `TODO`를 다시 거치지 않고 `IN_PROGRESS`로 직접 이동하는 경우 `startedAt`은 변경되지 않는다 — "TODO로 이동 시"라는 조건에만 해당하기 때문이다.

### 5.2 완료 처리 자동화 (`completedAt`)

| 이동 | 처리 | 근거 |
|------|------|------|
| 어느 칼럼 → `DONE` | `status` = `DONE`, `completedAt` = 현재 시각, `position` = Done 칼럼 최솟값 - 1024 | FR-005 (`PATCH /api/tickets/:id/complete`) |
| `DONE` → 다른 칼럼(`BACKLOG`/`TODO`/`IN_PROGRESS`) | `completedAt` = `null` | FR-007 (`PATCH /api/tickets/reorder`) |

- `DONE` 진입과 `DONE` 이탈은 서로 다른 API가 처리한다: 진입은 `/complete`(FR-005), 이탈은 `/reorder`(FR-007). `/reorder`는 `status`에 `DONE`을 허용하지 않으므로 두 API가 겹치지 않는다.
- `DONE`에 재진입할 때마다 `completedAt`은 새 현재 시각으로 갱신된다 (기존 값을 유지하지 않음).

### 5.3 오버듀(Overdue) 판정 (`isOverdue`)

- **판정식**: `isOverdue = (status !== 'DONE') && (dueDate !== null) && (dueDate < now)`
- DB 컬럼으로 저장하지 않는 파생 필드다. `idx_tickets_due_date` 인덱스는 이 판정을 위한 조회를 지원하기 위한 것이지, 판정 결과 자체를 저장하기 위한 것이 아니다.
- 적용 대상 응답: `GET /api/tickets`(FR-002), `GET /api/tickets/:id`(FR-003), `PATCH /api/tickets/:id`(FR-004), `PATCH /api/tickets/reorder`(FR-007). `POST /api/tickets`(FR-001)는 생성 직후 응답에도 동일 규칙을 적용해 `isOverdue`를 포함한다.
- `status === 'DONE'`이거나 `dueDate === null`이면 무조건 `false`이며, 이 두 조건이 `dueDate < now` 비교보다 우선 평가된다.
- 프론트엔드에서도 동일한 판정식으로 클라이언트 사이드 재연산이 가능하다 (실시간 표시 목적, 서버 재조회 없이).

### 5.4 Done 칼럼 24시간 필터

- Done 칼럼에는 `completedAt` 기준 **현재 시각으로부터 24시간 이내**에 완료된 티켓만 표시한다 (FR-005).
- 이 필터는 `status = 'DONE'`인 모든 행에 적용되는 게 아니라 `GET /api/tickets`(FR-002)의 **조회 시점 필터링**이다 — 24시간이 지난 DONE 티켓은 삭제되거나 상태가 바뀌는 것이 아니라, 단지 보드 응답에서 제외될 뿐이다.
- `idx_tickets_completed_at` 인덱스는 이 조회(`WHERE status = 'DONE' AND completed_at > now() - interval '24 hours'`)를 지원한다.
- 24시간이 지나 보드에서 사라진 DONE 티켓도 `GET /api/tickets/:id`(FR-003)로 단건 조회하면 여전히 확인 가능하다 (하드 삭제되지 않으므로).

### 5.5 Position 관리

**정렬 방향**: 모든 칼럼은 `position` **오름차순**으로 정렬되며, 작은 값일수록 칼럼 상단에 표시된다.

**신규 배치 규칙**:
| 상황 | position 계산 | 근거 |
|------|------|------|
| 티켓 생성 (`BACKLOG`) | 해당 칼럼 최솟값 - 1024 (맨 위) | FR-001 |
| 완료 처리 (`DONE` 진입) | 해당 칼럼 최솟값 - 1024 (맨 위) | FR-005 |
| 칼럼에 티켓이 없는 경우 | `1024` | FR-001, FR-005 |

**드래그앤드롭 재계산 로직** (FR-007, `PATCH /api/tickets/reorder`):
| 삽입 위치 | 계산식 |
|------|------|
| 두 카드 사이 | `(prev.position + next.position) / 2` |
| 맨 앞 | `첫 번째 카드.position - 1024` |
| 맨 뒤 | `마지막 카드.position + 1024` |
| 간격이 1 미만 | 해당 칼럼 전체를 `1024` 간격으로 재정렬 |

- `position`은 `INTEGER`이므로 두 정수 사이 삽입을 무한히 반복하면 간격이 1 미만으로 좁아질 수 있다 — 이때 전체 재정렬이 트리거된다.
- 재정렬은 상태 이동이 발생한 해당 칼럼 내에서만 일어나며, 다른 칼럼의 `position` 값에는 영향을 주지 않는다.
- 상태(`status`)와 `position`은 항상 함께, 트랜잭션으로 갱신된다 (FR-007) — 둘 중 하나만 반영되는 중간 상태는 허용되지 않는다.

---
