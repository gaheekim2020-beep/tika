---

description: "Task list for PATCH /api/tickets/:id/complete implementation"
---

# Tasks: 티켓 완료 처리 API

**Input**: Design documents from `specs/005-complete-ticket-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/complete-ticket.md, research.md, quickstart.md

**Tests**: `docs/TEST_CASES.md`의 TC-API-005-01~07, TC-API-008-09가 이미 명시되어 있고, CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을 포함한다. 각 User Story는 "테스트 작성 → 실패 확인 → 구현 → 통과 확인" 순서로 진행한다.

**Organization**: 작업은 spec.md의 User Story(US1: 할 일을 완료 처리하기, US2: 완료된 할 일이 완료 칼럼 맨 위에 배치되기, US3: 존재하지 않는 항목·잘못된 식별자 완료 시도 처리) 단위로 그룹화한다. 이미 DONE인 티켓의 멱등 처리(spec FR-008)는 완료 처리 자체의 일부이므로 US1에 포함한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 대한 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1~US3)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·Zod 스키마), `src/server/`(백엔드 로직), `app/api/`(Route Handler), `__tests__/`(Jest, node 환경). 경계 규칙에 따라 `src/client/`는 수정하지 않는다. `src/shared/`에는 변경이 없다(새 타입·스키마 없음, 기존 `TICKET_STATUS`, `TicketWithMeta`, `ticketIdParamSchema` 재사용). 신규 라우트 파일 `app/api/tickets/[id]/complete/route.ts`를 만든다.

**테스트 공통 규칙** (CLAUDE.md): 서비스/API 테스트 파일 상단의 `/** @jest-environment node */`를 유지하고, 파일 끝의 최상위 `afterAll(() => db.$client.end())`를 지우지 않는다. 테스트는 `--runInBand`(순차)로 실행한다. 공유 DB(`tika_test`)를 쓰므로 각 테스트는 `afterEach`에서 `tickets`를 비운다(기존 패턴). 시각 비교는 짧은 대기에 의존하지 않는다: 완료 직후 값은 "요청 전후 시각 사이"인지로, 멱등 케이스는 과거 시각으로 직접 삽입한 행이 요청 뒤에도 같은 값인지로 검증한다. 날짜 계산은 UTC(`toISOString`)가 아니라 로컬 기준으로 한다(004에서 겪은 시간대 실패 방지).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 새 기능 구현 전 현재 베이스라인 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle 환경과 `001~004`의 스키마·헬퍼·라우트를 그대로 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드 작성 전 기준선 확보). 현재 브랜치가 `feature/complete-ticket`인지, `docs/API_SPEC.md` §5에 200/400/404/500 응답과 멱등 처리 규칙이 있는지도 확인한다.

**Checkpoint**: 베이스라인 확인 완료 → Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 테스트 케이스 정의와 position 계산 헬퍼 일반화. 헬퍼 없이는 어떤 스토리의 `completeTicket`도 완료 칼럼 위치를 계산할 수 없다.

**⚠️ CRITICAL**: 이 Phase 완료 전에는 User Story 작업을 시작할 수 없음

- [X] T002 `docs/TEST_CASES.md` §2.5(`PATCH /api/tickets/:id/complete`)에 spec.md 근거의 추가 케이스를 정의한다 (SDD: 테스트 코드 전에 케이스 문서화, constitution 개발 워크플로우). 기존 TC-API-005-01~07(07은 이미 DONE 멱등 케이스)은 수정하지 않고 다음을 추가:
      TC-API-005-08 BACKLOG 티켓 완료 처리 → 200, `status="DONE"`, `completedAt`=현재 시각, `startedAt`은 `null` 유지;
      TC-API-005-09 완료 후 다른 필드 불변 → 제목·설명·우선순위·시작예정일·종료예정일·`startedAt`·`createdAt`이 요청 전과 동일;
      TC-API-005-10 ID가 0 또는 음수 → 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다";
      TC-API-005-11 본문이 있어도 동일 결과 → 깨진 JSON 문자열 본문으로 요청해도 200이며 본문 없는 요청과 같은 결과;
      TC-API-005-12 완료 직후 보드 조회 → `GET /api/tickets`의 `DONE` 배열에 포함되고 맨 앞에 위치;
      TC-API-005-13 서비스 계층 예외 → 500 `INTERNAL_ERROR`, 메시지 "티켓을 완료 처리하지 못했습니다".
      §1 요약 표의 US-006 행 TC 범위(`TC-API-005-01~07`)도 `TC-API-005-01~13`으로 맞춘다.
- [X] T003 `src/server/services/ticketService.ts`에서 `getNextBacklogPosition`의 로직을 상태를 인자로 받는 내부 함수 `getNextTopPosition(status: TicketStatus): Promise<number>`로 추출한다 (research.md "getNextBacklogPosition을 getNextTopPosition(status)로 일반화"). 동작은 그대로: 해당 상태 행 중 `position` 최솟값을 조회해 없으면 `1024`, 있으면 `최솟값 - 1024`를 반환. `getNextBacklogPosition()`은 export 시그니처를 유지한 채 `getNextTopPosition(TICKET_STATUS.BACKLOG)`를 호출하는 래퍼로 남긴다 (기존 호출부·테스트 수정 금지). 리팩터링 전후로 `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`가 모두 통과해야 한다(기존 `createTicket` 테스트가 안전망). raw SQL 금지(Drizzle만).

**Checkpoint**: 테스트 케이스와 position 헬퍼 준비 완료 → User Story 구현 단계로 진행

---

## Phase 3: User Story 1 - 할 일을 완료 처리하기 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 백로그·할 일·진행 중 어느 상태의 티켓이든 완료 처리하면 `status`가 `DONE`이 되고 `completedAt`·`updatedAt`이 현재 시각으로 기록되며 `isOverdue`는 `false`로 반환된다. 나머지 필드는 변하지 않고, 이미 DONE인 티켓에 다시 요청하면 오류 없이 값이 그대로 반환된다.

**Independent Test**: TODO 상태 티켓을 만들어 완료 처리를 요청했을 때 `status="DONE"`, `completedAt`이 현재 시각, `updatedAt` 갱신, `isOverdue=false`인지, 그리고 이미 DONE인 티켓에 다시 요청하면 `completedAt`·`position`·`updatedAt`이 그대로인지 확인한다.

### Tests for User Story 1 ⚠️ (구현 전에 작성하고 실패를 확인한다 — Red)

- [X] T004 [P] [US1] `__tests__/services/ticketService.test.ts`에 `describe("completeTicket")` 추가 (import에 `completeTicket` 추가, 파일 상단 `@jest-environment node` 유지). 케이스: (a) TODO 티켓 완료 시 `status="DONE"`이고 `completedAt`이 요청 전후 시각 사이이며 `updatedAt`과 같은 값이고 `isOverdue=false`, (b) IN_PROGRESS 티켓 완료, (c) BACKLOG 티켓 완료 시 `startedAt`이 `null`로 유지, (d) 완료 후 제목·설명·우선순위·시작예정일·종료예정일·`startedAt`·`createdAt`·`id`가 요청 전과 동일, (e) 이미 DONE인 티켓(`completedAt`·`updatedAt`을 과거로, `position`을 임의 값으로 삽입)을 다시 완료 요청하면 세 값이 요청 전과 동일하고 반환값도 같음(멱등, FR-008), (f) 같은 티켓에 `Promise.all`로 `completeTicket`을 동시에 두 번 호출해도 두 응답의 `completedAt`·`position`이 같고 DB의 값과 일치(동시 요청 시에도 덮어쓰지 않음).
- [X] T005 [P] [US1] `__tests__/api/tickets.test.ts`에 `describe("PATCH /api/tickets/:id/complete")` 추가하고 상단 import에 `import { PATCH as COMPLETE } from "@/app/api/tickets/[id]/complete/route"`를 추가. 본문 없는 요청 헬퍼 `makeCompleteRequest()`(`method: "PATCH"`, 본문 없음)를 추가(기존 `makeParams` 패턴 재사용). 케이스: TC-API-005-01(TODO 완료, `completedAt`·`updatedAt` 갱신 — 과거 `updatedAt`으로 직접 삽입한 행 사용, `isOverdue=false`), TC-API-005-02(IN_PROGRESS 완료), TC-API-005-08(BACKLOG 완료), TC-API-005-09(다른 필드 불변), TC-API-005-07(이미 DONE → 200, 세 값 불변), TC-API-005-11(`body: "not json"` 문자열 본문으로 요청해도 200), TC-API-005-12(완료 직후 `GET /api/tickets`의 `DONE` 배열에 포함).
- [X] T006 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`를 실행해 T004/T005의 새 테스트가 **구현이 없어서 실패**(import 오류 또는 함수 없음)하는지 확인 (Red). 기존 테스트는 계속 통과해야 한다.

### Implementation for User Story 1

- [X] T007 [US1] `src/server/services/ticketService.ts`에 `completeTicket(id: number): Promise<TicketWithMeta | null>` 추가 (data-model.md, research.md 참조; `TICKET_STATUS`는 `@/shared/types`에서 import, drizzle-orm에서 `and`, `ne` import 추가). 절차: `const now = new Date()` → `position = await getNextTopPosition(TICKET_STATUS.DONE)` → `db.update(tickets).set({ status: TICKET_STATUS.DONE, completedAt: now, position, updatedAt: now }).where(and(eq(tickets.id, id), ne(tickets.status, TICKET_STATUS.DONE))).returning()`. 반환 행이 있으면 기존 `toTicketWithMeta(row)`로 변환해 반환. 반환 행이 없으면 `db.select().from(tickets).where(eq(tickets.id, id)).limit(1)`로 조회해 행이 없으면 `null`, 있으면(이미 DONE) **변경 없이** `toTicketWithMeta(row)` 반환. `completedAt`과 `updatedAt`은 반드시 같은 JS `Date` 값을 쓰고 DB `now()`/`defaultNow()`는 쓰지 않는다(research.md "completedAt과 updatedAt은 같은 JS Date"). `startedAt`·제목·설명·우선순위·일정·`createdAt`은 SET에 절대 넣지 않는다. raw SQL 금지(Drizzle만), React 코드 금지.
- [X] T008 [US1] 신규 파일 `app/api/tickets/[id]/complete/route.ts`에 `PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response>` 핸들러 추가 (기존 `app/api/tickets/[id]/route.ts`는 수정하지 않는다; import는 `NextResponse`, `ticketIdParamSchema`, `completeTicket`). 순서: `await params`로 `id` 획득 → `ticketIdParamSchema.safeParse`로 검증(실패 시 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다") → `try { completeTicket(parsed.data) }`: `null`이면 404 `TICKET_NOT_FOUND`(메시지 "존재하지 않거나 삭제된 티켓입니다"), 아니면 200 + 티켓, `catch`는 500 `INTERNAL_ERROR`(메시지 "티켓을 완료 처리하지 못했습니다"). **요청 본문은 읽지 않는다**(`request.json()` 호출 금지, spec FR-007). 비즈니스 로직은 넣지 않는다(constitution 원칙 V). 에러 응답은 `{ error: { code, message } }` 형식(원칙 III).
- [X] T009 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts` 실행해 T004/T005가 모두 통과하는지 확인 (Green), 필요하면 리팩터링.

**Checkpoint**: US1 완료 — 어느 상태에서든 완료 처리가 동작하고 멱등하게 처리됨 (MVP)

---

## Phase 4: User Story 2 - 완료된 할 일이 완료 칼럼 맨 위에 배치되기 (Priority: P2)

**Goal**: 완료된 티켓의 `position`은 Done 칼럼이 비어 있으면 `1024`, 아니면 `Done 칼럼 최솟값 - 1024`가 되어 칼럼 맨 위에 배치된다. 종료예정일이 지난 티켓도 완료 후 `isOverdue=false`다.

**Independent Test**: Done 칼럼이 비어 있는 상태와 이미 완료된 티켓이 있는 상태에서 각각 다른 티켓을 완료 처리해 `position`이 1024, 기존 최솟값보다 작은 값이 되는지 확인한다.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] `__tests__/services/ticketService.test.ts`의 `describe("completeTicket")`에 추가: (a) Done 칼럼에 티켓이 없으면 `position=1024`, (b) Done 칼럼 최솟값이 `1024`인 티켓이 있으면 새 `position=0`(`< 1024`), (c) 티켓을 연달아 두 개 완료하면 나중에 완료한 티켓의 `position`이 더 작음, (d) `completedAt`이 25시간 전이라 보드에서는 숨겨진 DONE 행(`position=500`)이 있어도 최솟값 계산에 포함되어 새 `position=-524`(research.md "Done 칼럼의 최솟값은 status = 'DONE'인 모든 행"), (e) 종료예정일이 어제인 미완료 티켓을 완료하면 `isOverdue=false`(TC-API-008-09; 서비스는 종료예정일을 검증하지 않으므로 과거 날짜 행을 직접 삽입해 준비).
- [X] T011 [US2] `__tests__/api/tickets.test.ts`의 `describe("PATCH /api/tickets/:id/complete")`에 추가: TC-API-005-03(Done 칼럼 비어 있음 → `position=1024`), TC-API-005-04(`position=1024`인 DONE 행이 있을 때 → 새 `position < 1024`), TC-API-008-09(`dueDate`=어제인 티켓 완료 → `isOverdue=false`, 날짜는 로컬 기준으로 계산).
- [X] T012 [US2] 새 테스트를 실행한다. T007의 구현이 이미 `getNextTopPosition(DONE)`으로 위치를 계산하므로 통과할 수 있다. **통과하면 회귀 방지 테스트로 유지**하고, 실패하면(특히 (d) 숨겨진 DONE 행 포함 여부) `src/server/services/ticketService.ts`의 `getNextTopPosition` 또는 `completeTicket`만 수정해 통과시킨다.

**Checkpoint**: US2 완료 — 완료 칼럼 배치 규칙이 검증됨

---

## Phase 5: User Story 3 - 존재하지 않는 항목·잘못된 식별자 완료 시도 처리 (Priority: P3)

**Goal**: 존재하지 않는 ID는 404, 형식이 잘못된 ID는 400 `INVALID_ID`, 서비스 예외는 500으로 처리되며 어떤 경우에도 데이터가 변경되지 않는다.

**Independent Test**: 존재하지 않는 ID와 `abc`/`0`/`-1` ID로 완료를 요청해 각각 404, 400 `INVALID_ID` 응답을 받는지 확인한다.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] `__tests__/services/ticketService.test.ts`의 `describe("completeTicket")`에 추가: 존재하지 않는 ID(예: `999999`)로 호출하면 `null`을 반환하고 다른 행(예: TODO 티켓)이 영향받지 않음.
- [X] T014 [US3] `__tests__/api/tickets.test.ts`에 추가: TC-API-005-06(`id="999999"` → 404 `TICKET_NOT_FOUND`, 메시지 "존재하지 않거나 삭제된 티켓입니다"), TC-API-005-05(`id="abc"` → 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다"), TC-API-005-10(`id="0"`, `id="-1"` → 400 `INVALID_ID`), TC-API-005-13(서비스 예외 → 500). 500 테스트는 기존 `PATCH /api/tickets/:id - 서버 오류` 패턴을 따라 별도 `describe("PATCH /api/tickets/:id/complete - 서버 오류")`로 분리하고 `jest.isolateModulesAsync` + `jest.doMock("@/server/services/ticketService", ...)`로 `completeTicket`이 `Error("DB 연결 실패")`로 거절되게 만든 뒤, mock 등록 이후에 라우트를 동적 import한다. 응답은 500 `INTERNAL_ERROR`, 메시지 "티켓을 완료 처리하지 못했습니다".
- [X] T015 [US3] 테스트를 실행해 T013/T014가 통과하는지 확인 (Green). T007/T008이 이미 `null`→404, `ticketIdParamSchema`→400, `catch`→500을 구현했으므로 통과할 수 있다. 통과하면 회귀 방지 테스트로 유지하고, 실패하면 해당 분기만 수정한다.

**Checkpoint**: US3 완료 — 모든 User Story 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 검증과 마무리

- [X] T016 전체 검증: `npx tsc --noEmit`, `npm run test`(`--runInBand`, Jest가 스스로 종료되는지 포함), `npm run build`가 모두 통과하는지 확인 (constitution 품질 게이트, 커밋 전 체크리스트).
- [ ] T017 [P] `specs/005-complete-ticket-api/quickstart.md`의 curl 시나리오를 `npm run dev`로 실행해 기대 결과(200 완료, 두 번째 티켓의 `position` 감소, 보드의 DONE 순서, 재요청 멱등, 깨진 본문도 200, 400/404)와 일치하는지 확인. 새 티켓은 BACKLOG로 만들어지므로 TODO/IN_PROGRESS 시나리오는 자동 테스트가 기준이다. 확인 후 개발 서버는 Ctrl+C로 정상 종료한다(강제 종료 시 좀비 커넥션 위험, CLAUDE.md 원인 4).
- [X] T018 [P] 구현 정리: `console.log` 잔재 제거 확인, `docs/API_SPEC.md` §5와 contracts/complete-ticket.md의 메시지·필드가 실제 구현과 일치하는지 대조, `src/client/`와 `src/shared/`가 수정되지 않았는지, `app/api/tickets/[id]/route.ts`가 수정되지 않았는지 `git diff --stat`으로 확인.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 User Story를 막음 (T003 헬퍼 추출이 핵심, T002 문서 정의는 테스트 작성 전에 완료)
- **User Stories (Phase 3~5)**: Foundational 완료 후. 우선순위 순(P1 → P2 → P3)으로 진행. US2~US3은 US1이 만든 `completeTicket`과 라우트 위에서 동작을 추가·검증하므로 **US1 완료 후** 진행한다
- **Polish (Phase 6)**: 원하는 User Story가 모두 끝난 후

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작. 서비스 함수(`completeTicket`)와 신규 라우트의 골격을 만들고 멱등 가드를 포함한다
- **US2 (P2)**: US1의 `completeTicket`을 재사용, 주로 테스트 추가(숨겨진 DONE 행 포함 여부가 핵심)
- **US3 (P3)**: US1의 라우트가 구현한 404/INVALID_ID/500 분기를 테스트로 확정

### Within Each User Story

- 테스트 작성 → 실패 확인(Red) → 구현 → 통과 확인(Green) → 리팩터링
- 같은 파일(`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`, `src/server/services/ticketService.ts`)을 수정하는 작업은 동시에 수행하지 않는다
- 각 Phase 체크포인트에서 검증한 뒤 다음으로 진행

### Parallel Opportunities

- US1: T004(서비스 테스트)와 T005(API 테스트)는 서로 다른 파일이라 병렬 가능
- US2: T010(서비스 테스트)과 T011(API 테스트) 병렬 가능
- US3: T013(서비스 테스트)과 T014(API 테스트) 병렬 가능
- Polish: T017, T018 병렬 가능 (T016 이후)

---

## Parallel Example: User Story 1

```text
# 서로 다른 파일의 테스트를 동시에 작성:
Task: "T004 [P] [US1] __tests__/services/ticketService.test.ts — completeTicket 서비스 테스트"
Task: "T005 [P] [US1] __tests__/api/tickets.test.ts — PATCH /complete 통합 테스트(TC-API-005-01, 02, 07, 08, 09, 11, 12)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001) 완료
2. Phase 2: Foundational (T002~T003) 완료 — 테스트 케이스와 position 헬퍼 준비
3. Phase 3: User Story 1 (T004~T009) 완료
4. **STOP and VALIDATE**: 완료 처리와 멱등 처리가 동작하는지 확인 (`completedAt`, `updatedAt`, `isOverdue` 포함)
5. 이 시점에서 `PATCH /complete`가 최소 동작하므로 필요하면 중간 커밋/데모

### Incremental Delivery

1. Setup + Foundational → 케이스 문서화, position 헬퍼 준비
2. US1 → 완료 처리 + 멱등 (MVP)
3. US2 → 완료 칼럼 맨 위 배치 규칙 검증
4. US3 → 404/INVALID_ID/500 확정
5. Polish → 빌드·수동 검증·정리

### Notes

- 커밋은 논리적 단위(예: 케이스 문서+헬퍼 리팩터링, US1, US2~US3 테스트 보강)로 나누고 메시지는 `[CL] feat: ...`, `[CL] test: ...`, `[CL] docs:`, `[CL] refactor: ...` 형식을 따른다.
- 이 기능은 완료 상태에서 다른 칼럼으로 되돌리기(`PATCH /api/tickets/reorder`, `completedAt = null` 처리), 수정, 삭제, 프론트엔드(`src/client/api/ticketApi.ts`, 드래그앤드롭 연동)를 포함하지 않는다.
- research.md의 "서로 다른 티켓의 동시 완료 시 position 중복 가능" 한계는 이번 범위에서 고치지 않는다(`createTicket`과 동일한 기존 한계).
- `created_at`/`updated_at` 시간 기준 불일치(프로젝트 메모리 기록 이슈)는 이번 기능에서 고치지 않으며, `completedAt`을 JS `Date`로 기록해 이를 넓히지 않는다.
