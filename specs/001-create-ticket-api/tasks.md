---

description: "Task list for POST /api/tickets implementation"
---

# Tasks: 티켓 생성 API

**Input**: Design documents from `specs/001-create-ticket-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/post-tickets.md, quickstart.md

**Tests**: TEST_CASES.md에 TC-API-001-01~13이 이미 명시되어 있고, CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을 포함한다.

**Organization**: 작업은 spec.md의 User Story(US1: 제목만으로 생성, US2: 상세 정보 포함 생성) 단위로 그룹화한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1, US2)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·검증), `src/server/`(백엔드 로직), `app/api/`(Route Handler), `__tests__/`(Jest, node 환경).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 이 기능 구현에 필요한 프로젝트 상태 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle 셋업 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드 작성 전 기준점 확보)

**Checkpoint**: 베이스라인 확인 완료 — Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 타입/스키마/DB 접근 기반. 이 단계 완료 전에는 어떤 User Story 작업도 시작할 수 없음.

**⚠️ CRITICAL**: T002~T006은 US1, US2 둘 다의 선행 조건이다.

- [X] T002 [P] `src/shared/types/index.ts`에 `TICKET_STATUS`, `TICKET_PRIORITY` const 객체와 `TicketStatus`/`TicketPriority` 타입, `Ticket`/`TicketWithMeta` 인터페이스를 DATA_MODEL.md §4 명세대로 작성 (status 허용값 `BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE`, priority 허용값 `LOW`/`MEDIUM`/`HIGH`)
- [X] T003 [P] `src/shared/types/index.ts`에 `CreateTicketInput` 인터페이스 추가 (`title: string`, `description?: string`, `priority?: TicketPriority`, `plannedStartDate?: string`, `dueDate?: string` — DATA_MODEL.md §4)
- [X] T004 `src/shared/validations/ticket.ts`에 `createTicketSchema` Zod 스키마 작성: `title`은 `.trim().min(1).max(200)`(공백만 입력 시 실패, 1~200자 제약을 벗어나면 실패), `description`은 `.max(1000)` 선택 필드, `priority`는 `z.enum(["LOW","MEDIUM","HIGH"])`에 `.default("MEDIUM")`, `plannedStartDate`/`dueDate`는 ISO 8601 date string 선택 필드, `dueDate`는 `.refine()`으로 오늘 이후 날짜만 허용 (data-model.md 참조). `export type CreateTicketInput = z.infer<typeof createTicketSchema>`로 T003 타입을 대체
- [X] T005 [P] `src/server/services/ticketService.ts`에 position 계산 헬퍼 `getNextBacklogPosition()` 작성: `tickets` 테이블에서 `status = 'BACKLOG'`인 행의 `position` 최솟값을 Drizzle로 조회, 존재하면 `최솟값 - 1024`, 없으면 `1024` 반환 (DATA_MODEL.md §5.5)
- [X] T006 [P] `src/server/services/ticketService.ts`에 `isOverdue` 계산 헬퍼 `calculateIsOverdue(status, dueDate)` 작성: `status !== 'DONE' && dueDate != null && dueDate < now` (DATA_MODEL.md §5.3)

**Checkpoint**: 공유 타입, Zod 스키마, 서비스 헬퍼 준비 완료 — User Story 구현 시작 가능

---

## Phase 3: User Story 1 - 제목만으로 빠르게 할 일 등록 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 제목만 입력해 새 할 일을 등록하면 Backlog 칼럼 최상단에 나타나고, 나머지 필드는 기본값으로 채워진다.

**Independent Test**: 제목 문자열 하나만 담아 `POST /api/tickets`를 호출했을 때 `201`과 함께 `status: "BACKLOG"`, `priority: "MEDIUM"`, 계산된 `position`이 반환되는지 확인.

### Tests for User Story 1 (TDD — 구현 전에 작성하고 실패를 확인)

- [X] T007 [P] [US1] `__tests__/services/ticketService.test.ts`(`/** @jest-environment node */`)에 `createTicket()` 단위 테스트 작성: 제목만 입력 시 `status='BACKLOG'`, `priority='MEDIUM'`, `description=null`, `plannedStartDate=null`, `dueDate=null`이 반환되는지 검증 (TC-API-001-01 상당)
- [X] T008 [P] [US1] `__tests__/services/ticketService.test.ts`에 position 계산 테스트 추가: BACKLOG 칼럼이 비어 있으면 `position=1024`(TC-API-001-03), 기존 최솟값이 `0`이면 새 티켓은 `-1024`(TC-API-001-04)가 되는지 검증
- [X] T009 [P] [US1] `__tests__/api/tickets.test.ts`(`/** @jest-environment node */`)에 `POST /api/tickets` 통합 테스트 작성: 제목만 담아 요청 시 `201`, 응답 body가 `docs/API_SPEC.md` §1 스키마와 일치하는지, `isOverdue: false`인지 검증 (TC-API-001-01)
- [X] T010 [P] [US1] `__tests__/api/tickets.test.ts`에 예외 케이스 추가: 제목 누락(TC-API-001-07)과 공백만 입력(TC-API-001-08) 시 `400` + `{error:{code:"VALIDATION_ERROR",field:"title",message:"제목을 입력해주세요"}}`, 제목 200자 초과 시(TC-API-001-09) `400` + 해당 메시지 검증

### Implementation for User Story 1

- [X] T011 [US1] `src/server/services/ticketService.ts`에 `createTicket(input: CreateTicketInput): Promise<TicketWithMeta>` 구현: T005의 position 헬퍼로 위치 계산 → `status: 'BACKLOG'`로 Drizzle `insert` 실행 → T006의 `calculateIsOverdue`로 `isOverdue` 계산 → `TicketWithMeta` 반환 (의존: T002~T006)
- [X] T012 [US1] `app/api/tickets/route.ts`에 `POST` 핸들러 작성: `request.json()` 파싱 → `createTicketSchema.safeParse()` 실패 시 `400` + `VALIDATION_ERROR` 응답 → 성공 시 `ticketService.createTicket()` 호출 → `201` + 결과 반환 → 예기치 못한 예외는 `500` + `INTERNAL_ERROR` 응답 (의존: T004, T011)
- [X] T013 [US1] T007~T010의 모든 테스트가 통과하는지 `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`로 확인 (Green 단계)

**Checkpoint**: User Story 1 완전히 동작 — 제목만으로 티켓 생성이 독립적으로 테스트 가능한 상태

---

## Phase 4: User Story 2 - 상세 정보를 포함해 할 일 등록 (Priority: P2)

**Goal**: 사용자가 제목과 함께 설명, 우선순위, 시작예정일, 종료예정일을 입력해 등록할 수 있다.

**Independent Test**: 모든 선택 필드를 채워 `POST /api/tickets`를 호출했을 때 입력값이 응답에 그대로 반영되는지, 그리고 각 필드 검증 실패 시 올바른 에러가 반환되는지 확인.

### Tests for User Story 2

- [X] T014 [P] [US2] `__tests__/api/tickets.test.ts`에 상세 정보 포함 생성 테스트 추가: description/priority/plannedStartDate/dueDate를 모두 채워 요청 시 입력값이 응답에 그대로 반영되는지 검증 (TC-API-001-02), description 생략 시 `null`로 채워지는지(TC-API-001-05), priority 생략 시 `MEDIUM`으로 채워지는지(TC-API-001-06) 검증
- [X] T015 [P] [US2] `__tests__/api/tickets.test.ts`에 필드별 검증 실패 테스트 추가: description 1001자 초과(TC-API-001-10) → `400`+`field:"description"`, 잘못된 priority 값 "URGENT"(TC-API-001-11) → `400`+`field:"priority"`+"우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요", 과거 dueDate(TC-API-001-12) → `400`+`field:"dueDate"`+"종료예정일은 오늘 이후 날짜를 선택해주세요"
- [X] T016 [P] [US2] `__tests__/api/tickets.test.ts`에 DB 오류 시나리오 테스트 추가: DB insert가 실패하도록 mock한 뒤 `500`+`{error:{code:"INTERNAL_ERROR",message:"서버 오류가 발생했습니다"}}` 반환 확인 (TC-API-001-13)

### Implementation for User Story 2

- [X] T017 [US2] T004의 `createTicketSchema`가 description/priority/plannedStartDate/dueDate 모든 조합(전체 입력, 전체 생략, 일부 생략)을 올바르게 처리하는지 점검하고 필요 시 보완 (기본값·nullable 처리, US1 스키마 재사용 — 별도 파일 신설 없음) — 점검 결과 기존 스키마가 모든 조합을 이미 올바르게 처리함, 수정 불필요
- [X] T018 [US2] `app/api/tickets/route.ts`의 에러 응답 매핑이 T015의 3가지 필드별 메시지를 `docs/API_SPEC.md` §1 400 표와 정확히 일치하게 반환하는지 확인하고 필요 시 보완 (의존: T012) — 점검 결과 기존 매핑이 이미 정확히 일치함, 수정 불필요
- [X] T019 [US2] T014~T016의 모든 테스트가 통과하는지 `npm run test -- __tests__/api/tickets.test.ts`로 확인 (Green 단계) — 11개 테스트 전부 통과

**Checkpoint**: User Story 1과 User Story 2 모두 독립적으로 동작 — 상세 정보 포함 생성과 필드별 검증이 완비된 상태

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 두 User Story에 공통으로 영향을 미치는 마무리 작업

- [X] T020 `npx tsc --noEmit`으로 전체 타입 체크 통과 확인 (constitution 원칙 I)
- [X] T021 `npm run lint`로 ESLint 통과 확인, `console.log` 잔존 여부 확인
- [X] T022 `specs/001-create-ticket-api/quickstart.md`의 4개 curl 시나리오를 `npm run dev` 실행 상태에서 수동 재현하여 실제 응답이 문서와 일치하는지 확인
- [X] T023 `npm run build`로 프로덕션 빌드 성공 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 시작 — 모든 User Story를 블로킹
- **User Story 1 (Phase 3)**: Foundational 완료 후 시작 가능, 다른 스토리에 의존하지 않음
- **User Story 2 (Phase 4)**: Foundational 완료 후 시작 가능. Route Handler(T012)와 Zod 스키마(T004)를 US1과 공유하므로 실질적으로 US1 구현(T011, T012) 완료 후 진행하는 것을 권장하지만, 별도 파일을 추가하지 않으므로 기능적으로는 독립 테스트 가능
- **Polish (Phase 5)**: US1, US2 모두 완료 후 진행

### Within Each User Story

- 테스트(T007~T010, T014~T016)를 먼저 작성하고 실패를 확인한 뒤 구현(T011~T012, T017~T018)을 진행한다 (Red → Green)
- 서비스 레이어(T011) 완료 후 Route Handler(T012) 작성 (constitution 원칙 V: 계층 순서)

### Parallel Opportunities

- T002, T003, T005, T006은 서로 다른 관심사([P] 표시)이므로 병렬 가능 (단, 모두 T004 이전 또는 독립적으로 진행 가능)
- T007~T010은 각각 다른 assertion을 다루므로 [P] 병렬 작성 가능하나 같은 파일(`ticketService.test.ts` 또는 `tickets.test.ts`)에 쓰는 경우 병합 시 주의
- T014~T016도 동일하게 [P] 가능

---

## Parallel Example: User Story 1

```bash
# T007~T010을 병렬로 작성 (서로 다른 assertion, 파일 충돌 시 순차 병합)
Task: "createTicket() 기본값 테스트 in __tests__/services/ticketService.test.ts"
Task: "position 계산 테스트 in __tests__/services/ticketService.test.ts"
Task: "POST 통합 테스트(정상) in __tests__/api/tickets.test.ts"
Task: "POST 통합 테스트(제목 검증 실패) in __tests__/api/tickets.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (타입, Zod 스키마, position/isOverdue 헬퍼)
3. Phase 3: User Story 1 완료 (제목만으로 생성)
4. **STOP and VALIDATE**: User Story 1을 독립적으로 테스트 — 이 시점에 이미 실사용 가능한 최소 기능
5. 필요 시 배포/데모

### Incremental Delivery

1. Setup + Foundational 완료 → 기반 준비
2. User Story 1 추가 → 독립 테스트 → 배포/데모 (MVP!)
3. User Story 2 추가 → 독립 테스트 → 배포/데모
4. Polish 단계로 마무리

---

## Notes

- [P] 작업 = 서로 다른 파일 또는 서로 다른 관심사, 의존성 없음
- [Story] 라벨은 작업을 특정 User Story에 추적 가능하게 매핑
- 테스트는 구현 전에 작성하고 실패를 먼저 확인한다 (constitution 개발 워크플로우: TDD Red→Green→Refactor)
- 작업 완료마다 또는 논리적 단위로 커밋
- 각 체크포인트에서 멈춰 해당 스토리를 독립적으로 검증할 수 있다
- `route.ts`(T012)에 비즈니스 로직을 직접 작성하지 않는다 (constitution 원칙 V) — position 계산, isOverdue 계산은 반드시 `ticketService.ts`에 위치
