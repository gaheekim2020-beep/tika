---

description: "Task list for DELETE /api/tickets/:id implementation"
---

# Tasks: 티켓 삭제 API

**Input**: Design documents from `specs/006-delete-ticket-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/delete-ticket.md, research.md, quickstart.md

**Tests**: `docs/TEST_CASES.md`의 TC-API-006-01~05가 이미 명시되어 있고, CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을 포함한다. 각 User Story는 "테스트 작성 → 실패 확인 → 구현 → 통과 확인" 순서로 진행한다.

**Organization**: 작업은 spec.md의 User Story(US1: 더 이상 필요 없는 할 일 삭제하기, US2: 삭제는 되돌릴 수 없는 완전 삭제, US3: 존재하지 않는 항목·잘못된 식별자 삭제 시도 처리) 단위로 그룹화한다. 서비스 함수와 라우트 핸들러는 한 번에 만들어지므로 US1에서 구현하고, US2·US3은 그 위에서 동작 보증을 테스트로 확정한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 대한 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1~US3)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·Zod 스키마), `src/server/`(백엔드 로직), `app/api/`(Route Handler), `__tests__/`(Jest, node 환경). 경계 규칙에 따라 `src/client/`는 수정하지 않는다. `src/shared/`에는 변경이 없다(새 타입·스키마 없음, 기존 `ticketIdParamSchema` 재사용). 새 라우트 파일은 없고 기존 `app/api/tickets/[id]/route.ts`에 `DELETE` 핸들러를 추가한다.

**테스트 공통 규칙** (CLAUDE.md): 서비스/API 테스트 파일 상단의 `/** @jest-environment node */`를 유지하고, 파일 끝의 최상위 `afterAll(() => db.$client.end())`를 지우지 않는다. 테스트는 `--runInBand`(순차)로 실행한다. 공유 DB(`tika_test`)를 쓰므로 각 테스트는 `afterEach`에서 `tickets`를 비운다(기존 패턴). 삭제 여부는 응답뿐 아니라 DB를 직접 조회(`db.select().from(tickets)`)해서도 확인한다. 날짜 계산은 UTC(`toISOString`)가 아니라 로컬 기준으로 한다(004에서 겪은 시간대 실패 방지).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 새 기능 구현 전 현재 베이스라인 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle 환경과 `001~005`의 스키마·헬퍼·라우트를 그대로 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드 작성 전 기준선 확보). 현재 브랜치가 `feature/delete-ticket`인지, `docs/API_SPEC.md` §6에 204/400/404/500 응답과 404 문구("존재하지 않거나 삭제된 티켓입니다")가 있는지도 확인한다.

**Checkpoint**: 베이스라인 확인 완료 → Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 테스트 케이스 정의. 이 기능은 새 헬퍼가 필요하지 않다(쿼리 1회).

**⚠️ CRITICAL**: 이 Phase 완료 전에는 User Story 작업을 시작할 수 없음

- [X] T002 `docs/TEST_CASES.md` §2.6(`DELETE /api/tickets/:id`)에 spec.md 근거의 추가 케이스를 정의한다 (SDD: 테스트 코드 전에 케이스 문서화, constitution 개발 워크플로우). 기존 TC-API-006-01~05는 수정하지 않고 다음을 추가:
      TC-API-006-06 ID가 0 또는 음수 → 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다";
      TC-API-006-07 본문이 있어도 동일 결과 → 깨진 JSON 문자열 본문으로 요청해도 204이며 본문 없는 요청과 같은 결과;
      TC-API-006-08 삭제 후 다른 티켓 불변 → 같은 칼럼의 다른 티켓의 내용과 `position`이 삭제 전과 동일;
      TC-API-006-09 삭제 직후 보드 조회 → `GET /api/tickets`의 어느 칼럼에도 삭제한 티켓이 없음;
      TC-API-006-10 모든 상태 삭제 → BACKLOG·TODO·IN_PROGRESS·DONE(24시간 지나 보드에서 숨겨진 DONE 포함) 티켓이 모두 204로 삭제됨;
      TC-API-006-11 서비스 계층 예외 → 500 `INTERNAL_ERROR`, 메시지 "티켓을 삭제하지 못했습니다".
      §1 요약 표의 US-008 행 TC 범위(`TC-API-006-01~05`)도 `TC-API-006-01~11`로 맞춘다.

**Checkpoint**: 테스트 케이스 문서화 완료 → User Story 구현 단계로 진행

---

## Phase 3: User Story 1 - 더 이상 필요 없는 할 일 삭제하기 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 어느 상태의 티켓이든 삭제하면 본문 없는 204를 받고, 이후 같은 ID로 조회하면 404이며 보드 목록에도 나타나지 않는다.

**Independent Test**: 티켓을 하나 만들어 삭제를 요청했을 때 204와 빈 본문을 받고, 같은 ID로 상세 조회하면 404가 반환되는지 확인한다.

### Tests for User Story 1 ⚠️ (구현 전에 작성하고 실패를 확인한다 — Red)

- [X] T003 [P] [US1] `__tests__/services/ticketService.test.ts`에 `describe("deleteTicket")` 추가 (import에 `deleteTicket` 추가, 파일 상단 `@jest-environment node` 유지). 케이스: (a) 존재하는 티켓을 삭제하면 `true`를 반환하고 `getTicketById`가 `null`을 반환, (b) BACKLOG·TODO·IN_PROGRESS·DONE 각 상태의 티켓을 삭제하면 모두 `true`(DONE은 `completedAt`을 25시간 전으로 삽입한 행 포함).
- [X] T004 [P] [US1] `__tests__/api/tickets.test.ts`에 `describe("DELETE /api/tickets/:id")` 추가하고 상단 import에 `DELETE` 핸들러를 `@/app/api/tickets/[id]/route`에서 추가(기존 `GET`/`PATCH` import 패턴 따름). 본문 없는 요청 헬퍼 `makeDeleteRequest()`(`method: "DELETE"`, 본문 없음)를 추가(기존 `makeParams` 패턴 재사용). 케이스: TC-API-006-01(티켓 삭제 → 204, `await response.text()`가 빈 문자열, 이후 같은 ID로 `GET` 호출 시 404), TC-API-006-10(BACKLOG·TODO·IN_PROGRESS·DONE 티켓이 모두 204), TC-API-006-07(`body: "not json"` 문자열 본문으로 요청해도 204), TC-API-006-09(삭제 직후 `GET /api/tickets` 결과의 모든 칼럼에 삭제한 `id`가 없음).
- [X] T005 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`를 실행해 T003/T004의 새 테스트가 **구현이 없어서 실패**(import 오류 또는 함수 없음)하는지 확인 (Red). 기존 테스트는 계속 통과해야 한다.

### Implementation for User Story 1

- [X] T006 [US1] `src/server/services/ticketService.ts`에 `deleteTicket(id: number): Promise<boolean>` 추가 (data-model.md, research.md 참조). `const rows = await db.delete(tickets).where(eq(tickets.id, id)).returning({ id: tickets.id })`를 실행하고 `rows.length > 0`을 반환한다(없으면 `false`). 사전 조회는 하지 않는다(동시 삭제 시 한쪽만 `true`가 되도록 — research.md "DELETE ... RETURNING 한 번으로"). DB 오류는 잡지 않고 그대로 throw한다(Route Handler가 500으로 변환). raw SQL 금지(Drizzle만), React 코드 금지.
- [X] T007 [US1] `app/api/tickets/[id]/route.ts`에 `export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response>` 핸들러 추가 (기존 `GET`/`PATCH`는 수정하지 않는다; import에 `deleteTicket` 추가). 순서: `await params`로 `id` 획득 → `ticketIdParamSchema.safeParse`로 검증(실패 시 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다") → `try { deleteTicket(parsed.data) }`: `false`면 404 `TICKET_NOT_FOUND`(메시지 "존재하지 않거나 삭제된 티켓입니다"), `true`면 `new Response(null, { status: 204 })`, `catch`는 500 `INTERNAL_ERROR`(메시지 "티켓을 삭제하지 못했습니다"). **요청 본문은 읽지 않는다**(`request.json()` 호출 금지, spec FR-006). **204에는 `NextResponse.json`을 쓰지 않는다**(본문 없는 `Response` 사용 — research.md "204는 본문 없는 Response"). 비즈니스 로직은 넣지 않는다(constitution 원칙 V). 에러 응답은 `{ error: { code, message } }` 형식(원칙 III).
- [X] T008 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts` 실행해 T003/T004가 모두 통과하는지 확인 (Green), 필요하면 리팩터링.

**Checkpoint**: US1 완료 — 어느 상태에서든 삭제가 동작하고 이후 조회·보드에서 사라짐 (MVP)

---

## Phase 4: User Story 2 - 삭제는 되돌릴 수 없는 완전 삭제 (Priority: P2)

**Goal**: 삭제된 티켓은 DB에서 행이 완전히 제거되고(삭제 플래그 없음), 다른 티켓의 내용과 `position`은 변하지 않는다.

**Independent Test**: 티켓을 삭제한 직후 DB를 직접 조회했을 때 해당 행이 없고, 같은 칼럼의 다른 티켓이 삭제 전과 동일한지 확인한다.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] `__tests__/services/ticketService.test.ts`의 `describe("deleteTicket")`에 추가: (a) 삭제 직후 `db.select().from(tickets).where(eq(tickets.id, id))`로 직접 조회하면 행이 0개(Hard Delete, TC-API-006-02), (b) 같은 칼럼에 티켓 3개(`position` 1024/2048/3072)를 삽입하고 가운데 것을 삭제하면 나머지 둘의 제목·설명·우선순위·`position`·`updatedAt`이 삭제 전과 동일하고 `position`이 재정렬되지 않음(1024와 3072 그대로), (c) 다른 칼럼의 티켓은 영향 없음.
- [X] T010 [US2] `__tests__/api/tickets.test.ts`의 `describe("DELETE /api/tickets/:id")`에 추가: TC-API-006-02(삭제 후 DB 직접 조회 시 행이 없음), TC-API-006-08(같은 칼럼의 다른 티켓이 `GET /api/tickets`에서 삭제 전과 같은 내용·`position`으로 조회됨).
- [X] T011 [US2] 새 테스트를 실행한다. T006의 구현이 이미 `DELETE`만 수행하므로 통과할 수 있다. **통과하면 회귀 방지 테스트로 유지**하고, 실패하면 `src/server/services/ticketService.ts`의 `deleteTicket`만 수정해 통과시킨다(삭제 외의 갱신·재정렬을 넣지 않는다).

**Checkpoint**: US2 완료 — 완전 삭제와 다른 티켓 불변이 검증됨

---

## Phase 5: User Story 3 - 존재하지 않는 항목·잘못된 식별자 삭제 시도 처리 (Priority: P3)

**Goal**: 존재하지 않거나 이미 삭제된 ID는 404, 형식이 잘못된 ID는 400 `INVALID_ID`, 서비스 예외는 500으로 처리되며 어떤 경우에도 다른 데이터가 변경되지 않는다. 이미 삭제한 티켓의 재삭제는 성공으로 처리하지 않는다.

**Independent Test**: 존재하지 않는 ID, 이미 삭제한 ID, `abc`/`0`/`-1` ID로 삭제를 요청해 각각 404, 404, 400 `INVALID_ID` 응답을 받는지 확인한다.

### Tests for User Story 3 ⚠️

- [X] T012 [P] [US3] `__tests__/services/ticketService.test.ts`의 `describe("deleteTicket")`에 추가: (a) 존재하지 않는 ID(예: `999999`)로 호출하면 `false`를 반환하고 다른 행(예: TODO 티켓)이 영향받지 않음, (b) 같은 ID로 연달아 두 번 호출하면 첫 번째는 `true`, 두 번째는 `false`, (c) 같은 ID로 `Promise.all`로 동시에 두 번 호출하면 결과가 정확히 `[true, false]`의 순서 무관 조합(한쪽만 성공).
- [X] T013 [US3] `__tests__/api/tickets.test.ts`에 추가: TC-API-006-04(`id="999999"` → 404 `TICKET_NOT_FOUND`, 메시지 "존재하지 않거나 삭제된 티켓입니다"), TC-API-006-05(삭제한 ID 재요청 → 404 `TICKET_NOT_FOUND`), TC-API-006-03(`id="abc"` → 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다"), TC-API-006-06(`id="0"`, `id="-1"` → 400 `INVALID_ID`), TC-API-006-11(서비스 예외 → 500). 500 테스트는 기존 `PATCH /api/tickets/:id - 서버 오류` 패턴을 따라 별도 `describe("DELETE /api/tickets/:id - 서버 오류")`로 분리하고 `jest.isolateModulesAsync` + `jest.doMock("@/server/services/ticketService", ...)`로 `deleteTicket`이 `Error("DB 연결 실패")`로 거절되게 만든 뒤, mock 등록 이후에 라우트를 동적 import한다. 응답은 500 `INTERNAL_ERROR`, 메시지 "티켓을 삭제하지 못했습니다".
- [X] T014 [US3] 테스트를 실행해 T012/T013이 통과하는지 확인 (Green). T006/T007이 이미 `false`→404, `ticketIdParamSchema`→400, `catch`→500을 구현했으므로 통과할 수 있다. 통과하면 회귀 방지 테스트로 유지하고, 실패하면 해당 분기만 수정한다.

**Checkpoint**: US3 완료 — 모든 User Story 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 검증과 마무리

- [X] T015 전체 검증: `npx tsc --noEmit`, `npm run test`(`--runInBand`, Jest가 스스로 종료되는지 포함), `npm run build`가 모두 통과하는지 확인 (constitution 품질 게이트, 커밋 전 체크리스트).
- [X] T016 [P] `specs/006-delete-ticket-api/quickstart.md`의 curl 시나리오를 `npm run dev`로 실행해 기대 결과(204 빈 본문, 삭제 후 조회 404, 재삭제 404, 깨진 본문도 204, 400/404)와 일치하는지 확인. 확인 후 개발 서버는 Ctrl+C로 정상 종료한다(강제 종료 시 좀비 커넥션 위험, CLAUDE.md 원인 4).
- [X] T017 [P] 구현 정리: `console.log` 잔재 제거 확인, `docs/API_SPEC.md` §6과 contracts/delete-ticket.md의 메시지·상태 코드가 실제 구현과 일치하는지 대조(contracts의 "API_SPEC.md 반영 대기" 안내 문구도 반영 완료로 정정), `src/client/`와 `src/shared/`가 수정되지 않았는지, 기존 `GET`/`PATCH` 핸들러가 수정되지 않았는지 `git diff --stat`으로 확인.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 User Story를 막음 (T002 문서 정의는 테스트 작성 전에 완료)
- **User Stories (Phase 3~5)**: Foundational 완료 후. 우선순위 순(P1 → P2 → P3)으로 진행. US2~US3은 US1이 만든 `deleteTicket`과 `DELETE` 핸들러 위에서 동작 보증을 테스트로 확정하므로 **US1 완료 후** 진행한다
- **Polish (Phase 6)**: 원하는 User Story가 모두 끝난 후

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작. 서비스 함수(`deleteTicket`)와 `DELETE` 핸들러(400/404/204/500 분기 포함)를 만든다
- **US2 (P2)**: US1의 `deleteTicket`을 재사용, 주로 테스트 추가(Hard Delete와 다른 티켓 불변)
- **US3 (P3)**: US1의 핸들러가 구현한 404/INVALID_ID/500 분기와 재삭제 동작을 테스트로 확정

### Within Each User Story

- 테스트 작성 → 실패 확인(Red) → 구현 → 통과 확인(Green) → 리팩터링
- 같은 파일(`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`, `src/server/services/ticketService.ts`, `app/api/tickets/[id]/route.ts`)을 수정하는 작업은 동시에 수행하지 않는다
- 각 Phase 체크포인트에서 검증한 뒤 다음으로 진행

### Parallel Opportunities

- US1: T003(서비스 테스트)과 T004(API 테스트)는 서로 다른 파일이라 병렬 가능
- US2: T009(서비스 테스트)와 T010(API 테스트) 병렬 가능
- US3: T012(서비스 테스트)와 T013(API 테스트) 병렬 가능
- Polish: T016, T017 병렬 가능 (T015 이후)

---

## Parallel Example: User Story 1

```text
# 서로 다른 파일의 테스트를 동시에 작성:
Task: "T003 [P] [US1] __tests__/services/ticketService.test.ts — deleteTicket 서비스 테스트"
Task: "T004 [P] [US1] __tests__/api/tickets.test.ts — DELETE 통합 테스트(TC-API-006-01, 07, 09, 10)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001) 완료
2. Phase 2: Foundational (T002) 완료 — 테스트 케이스 문서화
3. Phase 3: User Story 1 (T003~T008) 완료
4. **STOP and VALIDATE**: 삭제 후 204, 이후 조회 404, 보드에서 사라짐을 확인
5. 이 시점에서 `DELETE /api/tickets/:id`가 최소 동작하므로 필요하면 중간 커밋/데모

### Incremental Delivery

1. Setup + Foundational → 케이스 문서화
2. US1 → 삭제 동작 (MVP)
3. US2 → 완전 삭제·다른 티켓 불변 검증
4. US3 → 404/INVALID_ID/500·재삭제 확정
5. Polish → 빌드·수동 검증·정리

### Notes

- 커밋은 논리적 단위(예: 케이스 문서화 + 스펙 문서, US1, US2~US3 테스트 보강)로 나누고 메시지는 `[CL] feat: ...`, `[CL] test: ...`, `[CL] docs:` 형식을 따른다.
- 이 기능은 일괄 삭제, 복구(휴지통), 삭제 후 칼럼 재정렬, 프론트엔드(`src/client/api/ticketApi.ts`, 삭제 확인 다이얼로그 `TC-COMP-008`)를 포함하지 않는다.
- research.md의 "삭제 후 칼럼 내 순서값의 빈 자리" 한계는 이번 범위에서 고치지 않는다(오름차순 정렬만 성립하면 표시 순서에 영향이 없음).
- `created_at`/`updated_at` 시간 기준 불일치(프로젝트 메모리 기록 이슈)는 이번 기능과 무관하다(삭제는 시각을 기록하지 않음).
