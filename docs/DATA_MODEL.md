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

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
```

### 설계 노트

- **`status`, `priority`는 `varchar`**: DB 레벨 `pgEnum`을 쓰지 않고 애플리케이션 레벨(Zod, `src/shared/types`)에서 값을 제약한다 (앞의 "칼럼 제약사항" 참조). 허용값 목록(`BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE`, `LOW`/`MEDIUM`/`HIGH`)의 단일 진실 공급원(source of truth)은 `src/shared/types`의 `const` 객체이며, 이 스키마는 그 값을 그대로 저장하는 컨테이너 역할만 한다.
- **`date` vs `timestamp` 구분**: `plannedStartDate`/`dueDate`는 사용자가 입력하는 "날짜만" 있는 값이라 `date` 타입을, `startedAt`/`completedAt`/`createdAt`/`updatedAt`은 시스템이 특정 시각에 자동 기록하는 값이라 `timestamp` 타입을 사용한다. DATA_MODEL.md의 "날짜 필드 구분" 표와 1:1 대응된다.
- **모든 날짜/시각 필드에 `{ mode: 'date' }`**: Drizzle의 `date()`/`timestamp()` 기본 반환 모드는 `string`이다. `mode: 'date'`를 명시해야 조회 결과가 JS `Date` 객체로 반환되며, FR-008 오버듀 판정(`dueDate < now`)처럼 날짜를 직접 비교하는 서비스 로직에서 문자열-Date 간 변환 실수 없이 일관되게 다룰 수 있다.
- **`updatedAt`에 `$onUpdate`**: UPDATE 쿼리마다 서비스 코드에서 `updatedAt: new Date()`를 매번 명시하지 않아도, Drizzle이 해당 로우가 갱신될 때 자동으로 현재 시각을 채운다. FR-004/FR-005/FR-007의 "수정/완료/재정렬 시 updatedAt 자동 갱신" 규칙을 스키마 레벨에서 보장해 누락을 방지한다.
- **인덱스는 복합 인덱스 1개 + 단일 인덱스 2개**: `(status, position)`은 보드 조회(`GET /api/tickets`)가 항상 "칼럼별로 묶고 position 순 정렬"하는 패턴이므로 복합 인덱스로 커버한다. `due_date`, `completed_at`은 각각 오버듀 판정과 Done 24시간 필터에 단독으로 쓰이므로 별도 인덱스로 둔다.
- **`$inferSelect` / `$inferInsert`**: Drizzle이 스키마로부터 자동 추론한 타입이다. `src/shared/types`에서 API 요청/응답 타입을 별도로 정의할 때 이 타입을 가공(Pick/Omit)해서 파생시키면 DB 스키마와 타입이 어긋나지 않는다.
- **`position` 기본값 `1`**: FR-001/FR-005의 "칼럼에 티켓이 없으면 position = 1024" 규칙은 애플리케이션(서비스 레이어)에서 계산해 명시적으로 삽입하는 값이며, 컬럼 기본값 `1`은 그 계산 로직을 거치지 않는 직접 INSERT(시드 데이터 등) 상황을 위한 안전값이다.
- **`raw SQL` 미사용**: CLAUDE.md 규칙("DB 쿼리는 Drizzle ORM으로만 작성, raw SQL 금지")에 따라 인덱스 정의도 `drizzle-orm/pg-core`의 `index()` 빌더만 사용했다.

### 마이그레이션 반영

스키마 정의 후에는 `npm run db:generate`로 마이그레이션 파일을 생성하고, `npm run db:migrate`로 실제 DB에 반영한다.

---
