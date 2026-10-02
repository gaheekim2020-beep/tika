---

description: "Task list for PATCH /api/tickets/reorder implementation"
---

# Tasks: 티켓 상태/순서 변경 API (드래그앤드롭)

**Input**: Design documents from `specs/007-reorder-ticket-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/reorder-ticket.md, research.md, quickstart.md

**Tests**: `docs/TEST_CASES.md` §2.7에 TC-API-007-01~26이 정의되어 있고(15~26은 2026-10-01 승인으로 추가), CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을 포함한다. 각 User Story는 "테스트 작성 → 실패 확인 → 구현 → 통과 확인" 순서로 진행한다.

**Organization**: 작업은 spec.md의 User Story(US1: 다른 칼럼으로 옮기거나 같은 칼럼 안에서 순서 바꾸기, US2: 이동에 따른 시작·완료 시각 자동 관리, US3: 완료 칼럼으로의 이동 금지와 잘못된 요청 처리) 단위로 그룹화한다. `reorderTicket` 서비스는 US1에서 칼럼·순서 이동까지만 만들고 US2에서 시각 규칙을 얹는다. 라우트 핸들러는 한 번에 만들어지므로 US1에서 모든 분기(400/404/500)를 구현하고, US3은 그 위에서 거부·오류 동작을 테스트로 확정한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 대한 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1~US3)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·Zod 스키마), `src/server/`(백엔드 로직), `app/api/`(Route Handler), `__tests__/`(Jest, node 환경). 경계 규칙에 따라 `src/client/`는 수정하지 않는다. `src/shared/types`는 변경이 없다(`ReorderTicketInput`, `ReorderableStatus`가 이미 있음). 새 라우트 파일 `app/api/tickets/reorder/route.ts`를 만들고, 기존 `app/api/tickets/[id]/route.ts`는 수정하지 않는다.

**테스트 공통 규칙** (CLAUDE.md): 서비스/API 테스트 파일 상단의 `/** @jest-environment node */`를 유지하고, 파일 끝의 최상위 `afterAll(() => db.$client.end())`를 지우지 않는다. 테스트는 `--runInBand`(순차)로 실행한다. 공유 DB(`tika_test`)를 쓰므로 각 테스트는 `afterEach`에서 `tickets`를 비운다(기존 패턴). 이동 결과는 응답뿐 아니라 DB를 직접 조회(`db.select().from(tickets)`)해서도 확인한다. 날짜 계산은 UTC(`toISOString`)가 아니라 로컬 기준으로 한다(004에서 겪은 시간대 실패 방지). `position` 값은 TEST_CASES §2.7의 예시(1024/2048/3072, 1536, 0)를 그대로 쓴다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 새 기능 구현 전 현재 베이스라인 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle 환경과 `001~006`의 스키마·헬퍼·라우트를 그대로 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드 작성 전 기준선 확보). 현재 브랜치가 `feature/reorder-ticket`인지 확인하고, 설계 전제인 문서 선행 수정이 반영되어 있는지 대조한다: `docs/API_SPEC.md` §7에 400 세부 응답·500 응답 행·`position` 올림 규칙·"백로그로 이동 시 `startedAt = null`"이 있고, `docs/TEST_CASES.md` §2.7에 TC-API-007-15~26이 있다.

**Checkpoint**: 베이스라인 확인 완료 → Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 요청 검증 스키마. (구현 순서: shared 검증 스키마 → 테스트 → 서비스 → 라우트, CLAUDE.md)

**⚠️ CRITICAL**: 이 Phase 완료 전에는 User Story 작업을 시작할 수 없음

- [X] T002 `src/shared/validations/ticket.ts`에 `reorderTicketSchema`를 추가한다 (data-model.md "신규 검증 스키마", research.md "Zod 스키마" 참조). 기존 `createTicketSchema`/`updateTicketSchema`/`ticketIdParamSchema`는 수정하지 않는다. 필드 제약은 다음을 그대로 따른다:
      `ticketId` — 양의 정수, 메시지 "유효하지 않은 티켓 ID입니다" (필드 누락·문자열·0·음수·소수 모두 같은 메시지);
      `status` — `BACKLOG`/`TODO`/`IN_PROGRESS` 중 하나(`TICKET_STATUS` 상수 사용, `DONE` 제외), 메시지 "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" (누락·`DONE`·`ARCHIVED` 등 모두 같은 메시지);
      `position` — 정수이며 32비트 범위(`-2147483648` ~ `2147483647`), 메시지 "위치는 -2147483648 이상 2147483647 이하의 정수로 입력해주세요" (누락·문자열·소수·범위 초과 모두 같은 메시지).
      정의되지 않은 키는 제거된다(`z.object` 기본 동작, `updateTicketSchema`와 동일). `z.infer` 결과가 `@/shared/types`의 `ReorderTicketInput`과 형태가 일치하도록 유지하고, 주석으로 그 관계를 남긴다(constitution 원칙 I). `any` 금지.
- [X] T003 `npx tsc --noEmit`으로 T002 이후 타입 오류가 없는지 확인한다.

**Checkpoint**: 검증 스키마 준비 완료 → User Story 구현 단계로 진행

---

## Phase 3: User Story 1 - 할 일을 다른 칼럼으로 옮기거나 같은 칼럼 안에서 순서 바꾸기 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 `BACKLOG`/`TODO`/`IN_PROGRESS` 칼럼으로 티켓을 옮기거나 같은 칼럼 안에서 순서를 바꾸면, 요청한 `position`이 그대로 저장되고(겹치면 칼럼을 재정렬하되 이동 티켓이 겹친 티켓 앞) 이동이 반영된 4개 칼럼 보드를 응답으로 받는다.

**Independent Test**: 서로 다른 칼럼에 티켓이 있는 상태에서 한 티켓을 다른 칼럼의 특정 위치로 이동 요청했을 때, 응답 보드에서 그 티켓이 새 칼럼의 요청한 위치에 있고 원래 칼럼에는 없는지 확인한다.

### Tests for User Story 1 ⚠️ (구현 전에 작성하고 실패를 확인한다 — Red)

- [X] T004 [P] [US1] `__tests__/services/ticketService.test.ts`에 `describe("reorderTicket")` 추가 (import에 `reorderTicket` 추가, 파일 상단 `@jest-environment node` 유지, 기존 `completeTicket`/`deleteTicket` 블록의 `insertTicket` 헬퍼 패턴을 이 블록 안에 복제 — 기본값 `status: TODO`, `position: 2048`). 이 단계에서는 `status`/`position`/`updatedAt`만 검증한다(시각 규칙은 US2). 케이스: (a) TC-API-007-01 — 같은 칼럼에 `1024`/`2048` 두 티켓과 이동 티켓이 있을 때 `position=1536`으로 이동하면 DB의 `position`이 `1536`, 반환 보드 칼럼이 `position` 오름차순; (b) TC-API-007-02 — 칼럼 첫 카드 `1024`일 때 `position=0`으로 이동하면 첫 번째가 됨; (c) TC-API-007-03 — 마지막 카드 `2048`일 때 `position=3072`로 이동하면 마지막이 됨; (d) 다른 칼럼으로 이동 — `BACKLOG`의 티켓을 `IN_PROGRESS`로 이동하면 DB `status`가 바뀌고 반환 보드의 `BACKLOG`에는 없고 `IN_PROGRESS`에 있음, 반환값은 `BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE` 4개 키; (e) TC-API-007-20 — 빈 칼럼으로 이동하면 유일한 항목이고 요청한 `position`(`1024`)이 그대로 저장됨; (f) TC-API-007-19 — 이미 `position=1024`인 티켓을 같은 칼럼·같은 `position`으로 요청하면 반환 보드 배치가 요청 전과 동일(충돌이 아님 — 자기 자신은 제외); (g) TC-API-007-04 — 대상 칼럼에 `1024`/`2048`/`3072` 티켓 A/B/C가 있고 이동 티켓을 `position=2048`로 이동하면 순서가 `[A, 이동, B, C]`이고 `position`이 `1024, 2048, 3072, 4096`으로 재할당됨(이동 티켓이 겹친 B 바로 앞); (h) TC-API-007-04 올림 시나리오 — A=`1024`, B=`1025`일 때 이동 티켓을 `position=1025`로 요청하면 순서가 `[A, 이동, B]`(A와 B 사이), 칼럼이 1024 간격으로 재정렬됨; (i) TC-API-007-26 — (g)와 같은 충돌 상황에서 다른 칼럼 티켓의 `position`과 이동 전 칼럼의 나머지 티켓 `position`은 변하지 않음; (j) TC-API-007-21 — 이동 후 제목·설명·우선순위·예정일·종료예정일·`createdAt`이 이동 전과 동일하고 `updatedAt`은 이동 전보다 이후 시각.
- [X] T004a [US1] `app/api/tickets/reorder/route.ts`에 임시 스텁을 만든다: `export async function PATCH(): Promise<Response> { return new Response(null, { status: 501 }); }`. T005의 테스트가 모듈 해석 오류로 `tickets.test.ts` 파일 전체(기존 001~006 테스트 포함)를 실패시키지 않고 개별 단언에서만 실패(Red)하게 하기 위한 임시 파일이며, T008에서 실제 핸들러로 통째로 교체한다.
- [X] T005 [P] [US1] `__tests__/api/tickets.test.ts`에 `describe("PATCH /api/tickets/reorder")` 추가하고 상단 import에 `PATCH as REORDER`를 `@/app/api/tickets/reorder/route`에서 추가(기존 `COMPLETE` import 패턴 따름). 요청 헬퍼 `makeReorderRequest(body: unknown)`(`method: "PATCH"`, `Content-Type: application/json`, `JSON.stringify(body)`)를 추가하고, DB 삽입 헬퍼는 기존 `describe`의 `insertTicket` 패턴을 따른다. 케이스: TC-API-007-01~03(200, 응답 보드에서 해당 티켓의 `position`이 요청값, 칼럼 `position` 오름차순), TC-API-007-04(충돌 시 200, 칼럼 1024 간격 재정렬, 이동 티켓이 겹친 티켓 앞), TC-API-007-19(같은 위치 → 200, 배치 불변), TC-API-007-20(빈 칼럼 → 200), TC-API-007-21(본문에 `title: "바뀌면 안 됨"`, `description` 등 다른 키를 함께 보내도 제목·설명·우선순위·예정일·종료예정일이 변경되지 않음), TC-API-007-23(응답이 `BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE` 4개 키를 모두 가지고, 응답 최상위에 `data` 같은 wrapper 키가 없으며(TC-API-COMMON-01), `completedAt`이 25시간 전인 DONE 티켓은 `DONE` 배열에 없음).
- [X] T006 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts --runInBand`를 실행해 T004/T005의 새 테스트가 **구현이 없어서 실패**(import 오류 또는 함수 없음)하는지 확인 (Red). T004a의 스텁(501) 덕분에 새 테스트만 실패하고 기존 테스트는 모두 통과해야 한다(기존 테스트가 함께 실패하면 스텁이 빠졌거나 import 경로가 틀린 것이다).

### Implementation for User Story 1

- [X] T007 [US1] `src/server/services/ticketService.ts`에 `reorderTicket(input: ReorderTicketInput): Promise<BoardData | null>` 추가 (data-model.md "서비스 함수", research.md 참조; import에 `ReorderTicketInput`과 필요한 Drizzle 연산자(`lt`/`gte` 등)만 추가, raw SQL 금지). 이 단계(US1)에서는 `status`/`position`/`updatedAt`만 갱신하고 `startedAt`/`completedAt`은 건드리지 않는다. `await db.transaction(async (tx) => { ... })` 안에서 순서대로:
      (1) `tx.select().from(tickets).where(eq(tickets.id, input.ticketId)).for("update")`로 대상 행을 읽는다. 없으면 `null`을 반환한다(트랜잭션 변경 없음);
      (2) `now = new Date()` 하나를 쓴다(DB `now()` 금지 — `completeTicket`과 같은 JS 시각 기준);
      (3) 이동 티켓을 **제외한**(`ne(tickets.id, input.ticketId)`) 대상 칼럼(`eq(tickets.status, input.status)`) 티켓을 `asc(tickets.position)`, `asc(tickets.id)` 순으로 `id`, `position`만 조회한다;
      (4) 요청 `position`과 같은 값이 하나라도 있으면 충돌: 순서를 `[position < 요청값인 티켓들] + [이동 티켓] + [position >= 요청값인 티켓들]`로 만들고 `1024, 2048, 3072, …`(`(index + 1) * 1024`)를 부여해, 이동 티켓은 `status`/`position`/`updatedAt: now`로, 값이 바뀐 다른 티켓은 `position`만 `tx.update`한다(행별 `update`, `sql` CASE 금지 — research.md). 충돌이 없으면 이동 티켓만 `{ status, position, updatedAt: now }`로 갱신한다;
      (5) 트랜잭션 밖(커밋 후)에서 `getBoardData()`를 호출해 반환한다.
      DB 오류는 잡지 않고 그대로 throw한다(트랜잭션 롤백, Route Handler가 500으로 변환). 서비스는 HTTP 상태 코드를 알지 못한다(constitution 원칙 V). React 코드 금지.
- [X] T008 [US1] `app/api/tickets/reorder/route.ts`의 T004a 스텁을 실제 핸들러로 교체해 `export async function PATCH(request: Request): Promise<Response>`만 둔다 (`app/api/tickets/[id]/route.ts`는 수정하지 않는다). 순서: `try { body = await request.json() } catch` → 400 `VALIDATION_ERROR`, 메시지 "요청 본문이 올바른 JSON 형식이 아닙니다"(`field` 없음 — `[id]/route.ts`의 `invalidBodyResponse`와 같은 형태를 이 파일 안에 정의, 공용 모듈 추출은 하지 않음) → `reorderTicketSchema.safeParse(body)` 실패 시: `issue = parsed.error.issues[0]`, `issue.path.length === 0`(본문이 객체가 아님)이면 같은 본문 오류 응답, `issue.path[0] === "status"`이면 `{ error: { code: "VALIDATION_ERROR", message: issue.message } }`(**`field` 생략** — API_SPEC §7, TC-API-COMMON-03), 그 외에는 `{ error: { code: "VALIDATION_ERROR", field: issue.path[0], message: issue.message } }`, 모두 400 → `try { const board = await reorderTicket(parsed.data) }`: `null`이면 404 `TICKET_NOT_FOUND`(메시지 "존재하지 않거나 삭제된 티켓입니다"), 아니면 `NextResponse.json(board, { status: 200 })`, `catch`는 500 `INTERNAL_ERROR`(메시지 "티켓 순서를 변경하지 못했습니다"). 비즈니스 로직은 넣지 않는다(constitution 원칙 V). 에러 응답은 `{ error: { code, message } }` 형식(원칙 III).
- [X] T009 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts --runInBand` 실행해 T004/T005가 모두 통과하는지 확인 (Green), 필요하면 리팩터링.

**Checkpoint**: US1 완료 — 칼럼 이동·순서 변경·충돌 재정렬이 동작하고 보드가 응답됨 (MVP)

---

## Phase 4: User Story 2 - 이동에 따른 시작·완료 시각 자동 관리 (Priority: P2)

**Goal**: 처음 작업에 들어가면(`TODO`/`IN_PROGRESS`) `startedAt`이 기록되고(이미 있으면 유지), 어느 칼럼에서든 `BACKLOG`로 돌아오면 `startedAt`이 비워지며, 완료된 티켓을 꺼내면 `completedAt`이 비워진다.

**Independent Test**: `startedAt`이 비어 있는 티켓을 `TODO`/`IN_PROGRESS`로 옮기면 값이 채워지고, 이미 있는 티켓은 값이 유지되며, `BACKLOG`로 되돌리면 비워지고, `DONE` 티켓을 다른 칼럼으로 옮기면 `completedAt`이 비워지는지 확인한다.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] `__tests__/services/ticketService.test.ts`의 `describe("reorderTicket")`에 추가 (시각은 요청 전후 `Date`로 범위 검증, 기존 `completeTicket` 테스트 패턴): (a) TC-API-007-05 — `startedAt=null`인 `BACKLOG` 티켓을 `TODO`로 이동하면 `startedAt`이 요청 전후 시각 사이; (b) TC-API-007-06 — `startedAt=null`인 `BACKLOG` 티켓을 `IN_PROGRESS`로 직접 이동하면 `startedAt`이 요청 전후 시각 사이; (c) TC-API-007-07 — `startedAt`이 3일 전인 `TODO` 티켓을 `IN_PROGRESS`로, 이어서 다시 `TODO`로 이동해도 `startedAt`이 3일 전 값 그대로; (d) TC-API-007-08 — `startedAt`이 설정된 `TODO` 티켓을 `BACKLOG`로 이동하면 `startedAt=null`; (e) TC-API-007-25 — `startedAt`이 설정된 `IN_PROGRESS` 티켓과 `startedAt`·`completedAt`이 설정된 `DONE` 티켓을 각각 `BACKLOG`로 이동하면 `startedAt=null`(DONE이면 `completedAt=null`도); (f) TC-API-007-09 — `completedAt`이 설정된 `DONE` 티켓을 `BACKLOG`/`TODO`/`IN_PROGRESS` 각각으로 이동하면 `completedAt=null`; (g) TC-API-007-10 — `completedAt=null`인 티켓을 `BACKLOG`→`TODO`→`IN_PROGRESS`로 이동해도 `completedAt`이 계속 `null`; (h) TC-API-007-24 — `completedAt`이 25시간 전이라 보드에서 숨겨진 `DONE` 티켓도 `TODO`로 이동되고 `completedAt=null`이 되며 이후 반환 보드의 `TODO`에 나타남; (i) `BACKLOG` 안에서 순서만 바꾸는 이동은 `startedAt`을 `null`로 유지.
- [X] T011 [P] [US2] `__tests__/api/tickets.test.ts`의 `describe("PATCH /api/tickets/reorder")`에 추가: 응답 보드의 해당 티켓(`startedAt`/`completedAt` 필드, ISO 문자열로 직렬화됨)으로 다음 케이스를 검증한다 — TC-API-007-05(`BACKLOG`→`TODO`, `startedAt` 기록), TC-API-007-06(`BACKLOG`→`IN_PROGRESS` 직접 이동, `startedAt` 기록), TC-API-007-07(이미 있는 `startedAt` 유지), TC-API-007-08(`TODO`→`BACKLOG`, `startedAt=null`), TC-API-007-09(`DONE`→`TODO`, `completedAt=null`), TC-API-007-10(`BACKLOG`→`TODO`→`IN_PROGRESS` 이동 중 `completedAt`이 계속 `null`), TC-API-007-24(`completedAt`이 25시간 전이라 보드에서 숨겨진 `DONE` 티켓을 `TODO`로 이동 → 200, `completedAt=null`, 응답 `TODO` 배열에 나타남), TC-API-007-25(`IN_PROGRESS`·`DONE`→`BACKLOG`, `startedAt=null`). 세부 조합(예: `BACKLOG` 안 순서 변경 시 `startedAt` 유지)은 T010의 서비스 테스트가 담당한다.
- [X] T012 [US2] 새 테스트를 실행해 **시각 규칙 구현이 없어서 실패**하는지 확인 (Red). US1 테스트는 계속 통과해야 한다.

### Implementation for User Story 2

- [X] T013 [US2] `src/server/services/ticketService.ts`의 `reorderTicket`에 시각 규칙을 추가한다 (data-model.md "시각 규칙", research.md 참조). T007의 (1)에서 읽은 이동 전 행(`current`)과 대상 `input.status`, `now`로 계산해 이동 티켓의 `update`에 포함한다(충돌/비충돌 두 경로 모두 동일하게 적용): `startedAt` — 대상이 `BACKLOG`이면 `null`(출발 칼럼 무관); 대상이 `TODO`/`IN_PROGRESS`이고 `current.startedAt === null`이면 `now`; 그 외에는 `current.startedAt` 유지(필드를 갱신 대상에서 제외). `completedAt` — `current.status === TICKET_STATUS.DONE`이면 `null`, 아니면 유지. 대상이 `DONE`인 경우는 T002 스키마가 이미 거절하므로 서비스에서 따로 처리하지 않는다. 규칙 계산은 작은 순수 함수로 분리해 테스트하기 쉽게 한다(같은 파일 내, export는 필요할 때만).
- [X] T014 [US2] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts --runInBand` 실행해 T010/T011과 US1 테스트가 모두 통과하는지 확인 (Green), 필요하면 리팩터링.

**Checkpoint**: US2 완료 — `startedAt`/`completedAt` 규칙이 모든 이동 방향에서 문서대로 동작

---

## Phase 5: User Story 3 - 완료 칼럼으로의 이동 금지와 잘못된 요청 처리 (Priority: P3)

**Goal**: `DONE`과 허용되지 않는 `status`, 형식이 잘못된 요청은 400, 존재하지 않는 `ticketId`는 404, 서비스 예외는 500으로 처리되며 어떤 경우에도 데이터가 바뀌지 않는다. 재정렬 도중 실패하면 전체가 롤백된다.

**Independent Test**: `status="DONE"`, `status="ARCHIVED"`, 존재하지 않는 `ticketId`, 형식이 잘못된 `ticketId`/`position`/본문으로 각각 이동을 요청해 400/404가 오고 DB가 그대로인지, 재정렬 도중 실패를 주입해도 어떤 행도 바뀌지 않는지 확인한다.

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] `__tests__/services/ticketService.test.ts`의 `describe("reorderTicket")`에 추가: (a) 존재하지 않는 `ticketId`(예: `999999`)로 호출하면 `null`을 반환하고 다른 행(예: `TODO` 티켓)의 `status`/`position`이 그대로; (b) TC-API-007-14 원자성 — **재정렬 경로**(충돌이 있는 이동)에서 `db.transaction`을 `jest.spyOn(db, "transaction")`으로 감싸 콜백에 넘겨지는 `tx`의 `update`가 두 번째 호출에서 예외를 던지게 만든 뒤 `reorderTicket`을 호출하면 예외가 전파되고(`rejects`), 호출 후 DB의 모든 티켓이 이동 전 값 그대로(`status`, `position`, `startedAt`, `completedAt`, `updatedAt`) — 이동 티켓의 갱신이 롤백되었음을 확인. spy는 테스트 끝에서 `mockRestore()`한다. 이 방식으로 실패 주입이 어려우면(research.md "TC-API-007-14 검증 방법") 이 작업 설명 끝에 대안을 기록하고 그 방식으로 구현한다.
- [X] T016 [US3] `__tests__/api/tickets.test.ts`의 `describe("PATCH /api/tickets/reorder")`에 추가: TC-API-007-11(`status="DONE"` → 400 `VALIDATION_ERROR`, 메시지 "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요", 응답 `error`에 `field` 키 없음, DB 불변), TC-API-007-12(`status="ARCHIVED"` → 400 `VALIDATION_ERROR`), TC-API-007-18(`status` 누락 → 400, `field` 없음), TC-API-007-13(`ticketId=999999` → 404 `TICKET_NOT_FOUND`, 메시지 "존재하지 않거나 삭제된 티켓입니다"), TC-API-007-15(`ticketId`가 `0`/`-1`/`"abc"`/누락 → 400, `error.field="ticketId"`, 메시지 "유효하지 않은 티켓 ID입니다" — `it.each`), TC-API-007-16(`position`이 누락/`"abc"`/`1.5`/`2147483648` → 400, `error.field="position"`, 메시지 "위치는 -2147483648 이상 2147483647 이하의 정수로 입력해주세요" — `it.each`), TC-API-007-17(본문이 `"not json"` 또는 `[]` → 400 `VALIDATION_ERROR`, `error.field` 없음, 메시지 "요청 본문이 올바른 JSON 형식이 아닙니다" — `it.each`; 문자열 본문은 `new Request(..., { body: "not json" })`로 직접 만든다), TC-API-007-22(서비스 예외 → 500). 거부 케이스(11, 12, 15~18)는 DB의 대상 티켓이 이동 전 값 그대로임을 함께 확인한다. 500 테스트는 기존 `PATCH /api/tickets/:id - 서버 오류` 패턴을 따라 별도 `describe("PATCH /api/tickets/reorder - 서버 오류")`로 분리하고 `jest.isolateModulesAsync` + `jest.doMock("@/server/services/ticketService", ...)`로 `reorderTicket`이 `Error("DB 연결 실패")`로 거절되게 만든 뒤, mock 등록 이후에 라우트를 동적 import한다. 응답은 500 `INTERNAL_ERROR`, 메시지 "티켓 순서를 변경하지 못했습니다".
- [X] T017 [US3] 테스트를 실행해 T015/T016이 통과하는지 확인 (Green). T002/T007/T008이 이미 스키마 검증·`null`→404·`catch`→500·트랜잭션 롤백을 구현했으므로 통과할 수 있다. 통과하면 회귀 방지 테스트로 유지하고, 실패하면 해당 분기만 수정한다(예: `status` 오류에서 `field`가 포함되면 T008의 `issue.path[0] === "status"` 분기를 수정).

**Checkpoint**: US3 완료 — 모든 User Story 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 검증과 마무리

- [X] T018 전체 검증: `npx tsc --noEmit`, `npm run test`(`--runInBand`, Jest가 스스로 종료되는지 포함), `npm run build`가 모두 통과하는지 확인 (constitution 품질 게이트, 커밋 전 체크리스트).
- [X] T019 [P] `specs/007-reorder-ticket-api/quickstart.md`의 curl 시나리오를 `npm run dev`로 실행해 기대 결과와 일치하는지 확인한다. **"0. 경로 충돌 확인"을 가장 먼저** 실행해 `PATCH /api/tickets/reorder`가 `[id]/route.ts`의 `PATCH`(400 `INVALID_ID`)가 아니라 새 핸들러로 가는지 확인한다(Jest는 핸들러를 직접 호출하므로 라우팅을 검증하지 못한다 — research.md "경로 충돌"). 확인 후 개발 서버는 Ctrl+C로 정상 종료한다(강제 종료 시 좀비 커넥션 위험, CLAUDE.md 원인 4). 라우팅이 `[id]`로 빠지면 여기서 중단하고 사용자에게 보고한다.
- [X] T020 [P] `docs/CODE_MAP.md`에 `PATCH /api/tickets/reorder (US-005, FR-007) — specs/007-reorder-ticket-api` 섹션을 추가한다. 기존 섹션과 같은 형식(계층별 위치 표 + TC별 API 테스트/서비스 테스트/Route 동작/스키마·서비스 링크 표, 한 테스트가 여러 TC를 검증하면 "(NN·MM 공용)" 표기)으로 TC-API-007-01~26을 연결하고, 실제 구현된 파일의 줄 번호로 링크를 맞춘다.
- [X] T021 [P] 구현 정리: `console.log` 잔재 제거 확인, `docs/API_SPEC.md` §7과 contracts/reorder-ticket.md의 메시지·상태 코드·`field` 유무가 실제 구현과 일치하는지 대조, `src/client/`와 `src/shared/types`가 수정되지 않았는지, 기존 `app/api/tickets/[id]/route.ts`·`complete/route.ts` 핸들러가 수정되지 않았는지 `git diff --stat`으로 확인. 프론트엔드 후속 작업(올림 규칙을 `docs/COMPONENT_SPEC.md` §3.6과 `src/client`의 position 계산에 반영)은 이번 범위가 아님을 PR 설명에 남긴다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 User Story를 막음 (T002 스키마는 API 테스트·라우트가 의존)
- **User Stories (Phase 3~5)**: Foundational 완료 후. 우선순위 순(P1 → P2 → P3)으로 진행. US2는 US1이 만든 `reorderTicket`에 시각 규칙을 추가하고, US3은 US1의 라우트 분기와 서비스 트랜잭션 위에서 동작 보증을 테스트로 확정하므로 **US1 완료 후** 진행한다
- **Polish (Phase 6)**: 원하는 User Story가 모두 끝난 후

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작. `reorderTicket`(칼럼·순서·충돌 재정렬)과 `PATCH` 핸들러(400/404/200/500 분기 포함)를 만든다
- **US2 (P2)**: US1의 `reorderTicket`을 확장(시각 규칙). 같은 함수를 수정하므로 US1 이후 순차
- **US3 (P3)**: US1의 핸들러·스키마·트랜잭션을 테스트로 확정. 새 구현이 필요 없을 수 있음

### Within Each User Story

- 테스트 작성 → 실패 확인(Red) → 구현 → 통과 확인(Green) → 리팩터링
- 같은 파일(`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`, `src/server/services/ticketService.ts`)을 수정하는 작업은 동시에 수행하지 않는다
- 각 Phase 체크포인트에서 검증한 뒤 다음으로 진행

### Parallel Opportunities

- US1: T004(서비스 테스트)와 T005(API 테스트)는 서로 다른 파일이라 병렬 가능
- US2: T010(서비스 테스트)과 T011(API 테스트) 병렬 가능
- US3: T015(서비스 테스트)와 T016(API 테스트) 병렬 가능
- Polish: T019, T020, T021 병렬 가능 (T018 이후)

---

## Parallel Example: User Story 1

```text
# 서로 다른 파일의 테스트를 동시에 작성:
Task: "T004 [P] [US1] __tests__/services/ticketService.test.ts — reorderTicket 서비스 테스트(칼럼·순서·충돌)"
Task: "T005 [P] [US1] __tests__/api/tickets.test.ts — PATCH /api/tickets/reorder 통합 테스트(TC-API-007-01~04, 19~21, 23)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001) 완료
2. Phase 2: Foundational (T002~T003) 완료 — 검증 스키마
3. Phase 3: User Story 1 (T004~T009) 완료
4. **STOP and VALIDATE**: 다른 칼럼 이동, 순서 변경, 충돌 재정렬, 보드 응답 확인
5. 이 시점에서 `PATCH /api/tickets/reorder`가 최소 동작하므로 필요하면 중간 커밋/데모

### Incremental Delivery

1. Setup + Foundational → 스키마 준비
2. US1 → 이동·순서 동작 (MVP)
3. US2 → `startedAt`/`completedAt` 규칙
4. US3 → 400/404/500·원자성 확정
5. Polish → 빌드·수동 검증(경로 충돌 포함)·CODE_MAP·정리

### Notes

- 커밋은 논리적 단위(예: 스키마 + US1, US2, US3 테스트 보강, CODE_MAP)로 나누고 메시지는 `[CL] feat: ...`, `[CL] test: ...`, `[CL] docs:` 형식을 따른다.
- 이 기능은 다건 이동, 이동 이력, 프론트엔드(`src/client/api/ticketApi.ts`의 reorder 호출, `useTickets.reorder`, 드래그앤드롭 UI와 낙관적 업데이트 롤백, 올림 규칙 반영)를 포함하지 않는다.
- research.md의 "범위 밖" — 서로 다른 티켓이 같은 칼럼의 같은 `position`으로 동시에 들어오는 경합은 단일 사용자 MVP 전제상 이번 범위에서 다루지 않는다.
- `created_at`/`updated_at` 시간 기준 불일치(프로젝트 메모리 기록 이슈)는 이번 기능과 무관하게 남는다. 다만 이번 기능은 `updatedAt`을 JS 시각(`new Date()`)으로 쓰므로 기존 `updateTicket`/`completeTicket`과 같은 기준을 따른다.
