---

description: "Task list for PATCH /api/tickets/:id implementation"
---

# Tasks: 티켓 수정 API

**Input**: Design documents from `specs/004-update-ticket-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/update-ticket.md, research.md, quickstart.md

**Tests**: `docs/TEST_CASES.md`의 TC-API-004-01~12가 이미 명시되어 있고, CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을 포함한다. 각 User Story는 "테스트 작성 → 실패 확인 → 구현 → 통과 확인" 순서로 진행한다.

**Organization**: 작업은 spec.md의 User Story(US1: 할 일 내용 부분 수정, US2: 설정된 값 비우기 및 빈 수정 요청, US3: 잘못된 입력값 거절, US4: 존재하지 않는 항목·잘못된 식별자 수정 시도 처리) 단위로 그룹화한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 대한 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1~US4)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·Zod 스키마), `src/server/`(백엔드 로직), `app/api/`(Route Handler), `__tests__/`(Jest, node 환경). 경계 규칙에 따라 `src/client/`는 수정하지 않는다. 기존 `app/api/tickets/[id]/route.ts`에 `PATCH`를 추가하므로 신규 라우트 파일은 없다.

**테스트 공통 규칙** (CLAUDE.md): 서비스/API 테스트 파일 상단의 `/** @jest-environment node */`를 유지하고, 파일 끝의 최상위 `afterAll(() => db.$client.end())`를 지우지 않는다. 테스트는 `--runInBand`(순차)로 실행한다. 공유 DB(`tika_test`)를 쓰므로 각 테스트는 `afterEach`에서 `tickets`를 비운다(기존 패턴).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 새 기능 구현 전 현재 베이스라인 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle 환경과 `001~003`의 스키마·헬퍼·라우트를 그대로 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드 작성 전 기준선 확보). 현재 브랜치가 `feature/update-ticket`인지도 확인한다.

**Checkpoint**: 베이스라인 확인 완료 → Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 수정 요청 본문 검증 스키마와 테스트 케이스 정의. 스키마 없이는 어떤 스토리의 PATCH 핸들러도 구현할 수 없다.

**⚠️ CRITICAL**: 이 Phase 완료 전에는 User Story 작업을 시작할 수 없음

- [X] T002 `docs/TEST_CASES.md` §2.4(`PATCH /api/tickets/:id`)에 spec.md 근거의 추가 케이스를 정의한다 (SDD: 테스트 코드 전에 케이스 문서화, constitution 개발 워크플로우). 기존 TC-API-004-01~12는 수정하지 않고 다음을 추가:
      TC-API-004-13 잘못된 ID 형식(`id="abc"`) → 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다";
      TC-API-004-14 ID가 0 또는 음수 → 400 `INVALID_ID`;
      TC-API-004-15 `dueDate: null`로 명시적 초기화 → 200, `dueDate=null`이고 `isOverdue=false`(기존에 기한이 지난 미완료 티켓 기준);
      TC-API-004-16 여러 필드 중 하나만 유효하지 않음(예: `{ title: "정상", priority: "URGENT" }`) → 400이고 `title`도 반영되지 않음;
      TC-API-004-17 본문이 JSON이 아니거나 객체가 아님 → 400 `VALIDATION_ERROR`, `field` 없음, 메시지 "요청 본문이 올바른 JSON 형식이 아닙니다";
      TC-API-004-18 서비스 계층 예외 → 500 `INTERNAL_ERROR`, 메시지 "티켓을 수정하지 못했습니다".
      §1 요약 표의 US-007 행 TC 범위(`TC-API-004-01~12`)도 `TC-API-004-01~18`로 맞춘다.
- [X] T003 `src/shared/validations/ticket.ts`에 `updateTicketSchema` 추가 (data-model.md, research.md "수정 스키마는 별도로 정의" 참조). `createTicketSchema.partial()`은 사용하지 않는다(`priority`의 `.default()`가 남아 우선순위를 덮어씀). 모든 필드 optional, `.default()` 없음, 정의되지 않은 키(`status`, `position` 등)는 Zod 기본 동작으로 제거(`.strict()` 사용 금지). 필드별 제약(data-model.md 그대로):
      `title` — 공백 제거 후 1~200자, `null` 불가, 오류 메시지 "제목을 입력해주세요"(비었거나 공백만) / "제목은 200자 이내로 입력해주세요";
      `description` — 최대 1000자, `null` 허용, 오류 메시지 "설명은 1000자 이내로 입력해주세요";
      `priority` — LOW/MEDIUM/HIGH 중 하나(`TICKET_PRIORITY` 사용), `null` 불가, 오류 메시지 "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요";
      `plannedStartDate` — 날짜 문자열(YYYY-MM-DD, `z.string().date()`), `null` 허용;
      `dueDate` — 날짜 문자열(YYYY-MM-DD), `null` 허용, 값이 있을 때만 기존 `isTodayOrAfter`로 오늘 이후 검증, 오류 메시지 "종료예정일은 오늘 이후 날짜를 선택해주세요"(`null`/`undefined`는 검증 생략).
      스키마의 추론 타입이 `src/shared/types/index.ts`의 `UpdateTicketInput`과 일치해야 한다(타입 파일은 변경하지 않는다, constitution 원칙 I).

**Checkpoint**: 수정 스키마와 테스트 케이스 준비 완료 → User Story 구현 단계로 진행

---

## Phase 3: User Story 1 - 할 일 내용 부분 수정 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 유효한 값으로 수정을 요청하면 요청에 포함된 항목만 갱신되고, 나머지는 유지되며, 최종 수정 시각이 갱신되고, 수정된 종료예정일 기준으로 `isOverdue`가 재계산되어 반환된다.

**Independent Test**: 상세 정보가 채워진 티켓을 만들어 제목만 수정 요청했을 때 제목만 바뀌고 나머지는 그대로이며 `updatedAt`이 갱신되는지 확인한다.

### Tests for User Story 1 ⚠️ (구현 전에 작성하고 실패를 확인한다 — Red)

- [X] T004 [P] [US1] `__tests__/services/ticketService.test.ts`에 `describe("updateTicket")` 추가 (import에 `updateTicket` 추가, 파일 상단 `@jest-environment node` 유지). 케이스: (a) 제목만 수정하면 제목만 바뀌고 나머지 필드(설명·우선순위·일정·`status`·`position`)는 유지, (b) 여러 필드(제목·설명·우선순위·시작예정일·종료예정일) 동시 수정 시 모두 반영, (c) 반환된 `updatedAt`이 수정 전 값보다 이후(테스트는 `updatedAt`을 과거로 지정해 `db.insert(tickets).values(...)` 한 행으로 준비해 시간 차이를 보장), (d) 종료예정일을 과거 날짜로 수정하면 미완료 티켓의 `isOverdue`가 `true`로 재계산(서비스는 검증하지 않으므로 과거 날짜 전달 가능), (e) `DONE` 티켓 수정 시 `completedAt`과 `status`가 유지.
- [X] T005 [P] [US1] `__tests__/api/tickets.test.ts`에 `describe("PATCH /api/tickets/:id")` 추가하고 상단 import를 `import { GET as GET_BY_ID, PATCH } from "@/app/api/tickets/[id]/route"`로 확장. 요청 헬퍼 `makePatchRequest(body: unknown)`(`method: "PATCH"`, `Content-Type: application/json`) 추가(기존 `makeRequest`/`makeParams` 패턴 재사용). 케이스: TC-API-004-01(제목만 수정, `updatedAt` 갱신 — 과거 `updatedAt`으로 직접 삽입한 행 사용), TC-API-004-02(여러 필드 동시 수정), TC-API-004-12(`{ status: "DONE" }` 포함 시 실제 상태·`position` 불변, 응답 200).
- [X] T006 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`를 실행해 T004/T005의 새 테스트가 **구현이 없어서 실패**(import 오류 또는 함수 없음)하는지 확인 (Red). 기존 테스트는 계속 통과해야 한다.

### Implementation for User Story 1

- [X] T007 [US1] `src/server/services/ticketService.ts`에 `updateTicket(id: number, input: UpdateTicketInput): Promise<TicketWithMeta | null>` 추가 (data-model.md, research.md 참조; `UpdateTicketInput`은 `@/shared/types`에서 import). `input`에서 값이 `undefined`가 아닌 키만 SET 값으로 구성(`null`은 컬럼 비우기), 날짜 문자열은 `new Date(...)`로 변환(`createTicket`과 동일 방식), `updatedAt: new Date()`를 **항상** SET에 포함, `db.update(tickets).set(...).where(eq(tickets.id, id)).returning()`을 한 번 실행하고 행이 없으면 `null`, 있으면 기존 `toTicketWithMeta(row)`로 변환해 반환. `status`/`position`/`startedAt`/`completedAt`은 SET에 절대 넣지 않는다. raw SQL 금지(Drizzle만), React 코드 금지.
- [X] T008 [US1] `app/api/tickets/[id]/route.ts`에 `PATCH(request, { params })` 핸들러 추가 (기존 `GET`은 수정하지 않는다; import에 `updateTicketSchema`, `updateTicket` 추가). 순서: `await params`로 `id` 획득 → `ticketIdParamSchema.safeParse`로 검증(실패 시 400 `INVALID_ID`, 메시지 "유효하지 않은 티켓 ID입니다") → `await request.json()` → `updateTicketSchema.safeParse`(실패 시 `POST /api/tickets`와 같은 형태로 400 `VALIDATION_ERROR`에 첫 이슈의 `field`(`issue.path[0]`)와 `message`) → `try { updateTicket(...) }`: `null`이면 404 `TICKET_NOT_FOUND`(메시지 "존재하지 않거나 삭제된 티켓입니다"), 아니면 200 + 티켓, `catch`는 500 `INTERNAL_ERROR`(메시지 "티켓을 수정하지 못했습니다"). 비즈니스 로직은 넣지 않는다(constitution 원칙 V).
- [X] T009 [US1] `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts` 실행해 T004/T005가 모두 통과하는지 확인 (Green), 필요하면 리팩터링.

**Checkpoint**: US1 완료 — 유효한 값으로 부분 수정이 동작하고 `updatedAt`/`isOverdue`가 갱신됨 (MVP)

---

## Phase 4: User Story 2 - 설정된 값 비우기 및 빈 수정 요청 (Priority: P2)

**Goal**: 설명·시작예정일·종료예정일을 `null`로 비울 수 있고, 아무 항목도 지정하지 않은 빈 요청이 오류 없이 처리되어 `updatedAt`만 갱신된다.

**Independent Test**: 설명과 시작예정일이 있는 티켓에 해당 값을 `null`로 수정 요청해 비워지는지, 빈 요청(`{}`)이 200이고 값은 유지되며 `updatedAt`만 갱신되는지 확인한다.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] `__tests__/services/ticketService.test.ts`의 `describe("updateTicket")`에 추가: (a) `description: null`이면 설명이 비워짐, (b) `plannedStartDate: null`이면 시작예정일이 비워짐, (c) `dueDate: null`이면 종료예정일이 비워지고 기한이 지난 미완료 티켓의 `isOverdue`가 `false`로 재계산(사전에 과거 `dueDate`의 미완료 행을 직접 삽입), (d) 빈 입력 `{}`이면 기존 값이 모두 유지되고 `updatedAt`만 이전보다 이후로 갱신(과거 `updatedAt`으로 삽입한 행 사용). (d)는 Drizzle의 빈 SET 동작(research.md의 미검증 항목)을 확인하는 핵심 테스트다.
- [X] T011 [US2] `__tests__/api/tickets.test.ts`의 `describe("PATCH /api/tickets/:id")`에 추가: TC-API-004-03(`description: null`), TC-API-004-04(`plannedStartDate: null`), TC-API-004-05(빈 body `{}` → 200, 값 유지, `updatedAt`만 갱신), TC-API-004-15(`dueDate: null`, `isOverdue=false`).
- [X] T012 [US2] 새 테스트를 실행한다. T007의 구현이 이미 `null` 통과와 `updatedAt` 명시 세팅을 지원하므로 통과할 수 있다. **통과하면 회귀 방지 테스트로 유지**하고, 실패하면(특히 (d) 빈 SET 오류) `src/server/services/ticketService.ts`의 `updateTicket`만 수정해 통과시킨다.

**Checkpoint**: US2 완료 — 값 비우기와 빈 요청이 동작

---

## Phase 5: User Story 3 - 잘못된 입력값 거절 (Priority: P2)

**Goal**: 유효하지 않은 값이 있으면 문제 항목(`field`)과 안내 문구가 담긴 400이 반환되고, 어떤 필드도 반영되지 않는다. 본문이 JSON이 아니거나 객체가 아니어도 400으로 처리된다.

**Independent Test**: 각 검증 규칙을 위반하는 값으로 수정을 요청해 문제 항목과 문구가 반환되고 기존 값이 유지되는지 확인한다.

### Tests for User Story 3 ⚠️

- [X] T013 [US3] `__tests__/api/tickets.test.ts`의 `describe("PATCH /api/tickets/:id")`에 추가: TC-API-004-06(`title: "   "` → 400, `field="title"`, "제목을 입력해주세요"), TC-API-004-07(201자 제목 → 400 title), TC-API-004-08(1001자 설명 → 400 description), TC-API-004-09(`priority: "URGENT"` → 400 priority), TC-API-004-10(`dueDate`=어제 → 400 dueDate, 로컬 기준 날짜로 계산), TC-API-004-16(`{ title: "정상", priority: "URGENT" }` → 400이고 DB 조회로 `title`이 바뀌지 않았음을 확인), TC-API-004-17(본문이 `not json` 문자열이거나 JSON 배열 `[]` → 400 `VALIDATION_ERROR`, 응답에 `field` 없음, 메시지 "요청 본문이 올바른 JSON 형식이 아닙니다"). 본문이 JSON이 아닌 요청은 `new Request(url, { method: "PATCH", body: "not json" })`처럼 문자열 본문으로 만든다.
- [X] T014 [US3] `app/api/tickets/[id]/route.ts`의 `PATCH`에서 `request.json()`을 `try/catch`로 감싸 파싱 실패 시 400 `VALIDATION_ERROR`(`field` 없음, 메시지 "요청 본문이 올바른 JSON 형식이 아닙니다")를 반환하도록 수정. `updateTicketSchema.safeParse` 실패 시 첫 이슈의 `path`가 비어 있으면(본문이 객체가 아닌 경우) `field`를 생략하고 같은 고정 메시지를 사용한다(Zod 기본 영어 메시지 노출 금지). 파싱 실패는 서비스를 호출하기 전에 반환한다.
- [X] T015 [US3] 테스트를 실행해 T013이 모두 통과하는지 확인 (Green). T008에서 이미 검증 오류 매핑을 구현했으므로 TC-API-004-06~10, 16은 통과할 수 있고, TC-API-004-17은 T014로 통과시킨다.

**Checkpoint**: US3 완료 — 검증 실패와 잘못된 본문이 명확히 거절됨

---

## Phase 6: User Story 4 - 존재하지 않는 항목·잘못된 식별자 수정 시도 처리 (Priority: P3)

**Goal**: 존재하지 않는 ID는 404, 형식이 잘못된 ID는 400 `INVALID_ID`, 서비스 예외는 500으로 처리되며 어떤 경우에도 데이터가 변경되지 않는다.

**Independent Test**: 존재하지 않는 ID와 `abc`/`0`/`-1` ID로 수정을 요청해 각각 404, 400 `INVALID_ID` 응답을 받는지 확인한다.

### Tests for User Story 4 ⚠️

- [X] T016 [P] [US4] `__tests__/services/ticketService.test.ts`의 `describe("updateTicket")`에 추가: 존재하지 않는 ID(예: `999999`)로 호출하면 `null`을 반환하고 다른 행이 영향받지 않음.
- [X] T017 [US4] `__tests__/api/tickets.test.ts`에 추가: TC-API-004-11(`id=999999`, 유효한 본문 → 404 `TICKET_NOT_FOUND`), TC-API-004-13(`id="abc"` → 400 `INVALID_ID`), TC-API-004-14(`id="0"`, `id="-1"` → 400 `INVALID_ID`), TC-API-004-18(서비스 예외 → 500). 500 테스트는 기존 `GET /api/tickets/:id - 서버 오류` 패턴을 따라 별도 `describe("PATCH /api/tickets/:id - 서버 오류")`로 분리하고 `jest.isolateModulesAsync` + `jest.doMock("@/server/services/ticketService", ...)`로 `updateTicket`이 `Error("DB 연결 실패")`로 거절되게 만든 뒤, mock 등록 이후에 라우트를 동적 import한다. 응답은 500 `INTERNAL_ERROR`, 메시지 "티켓을 수정하지 못했습니다".
- [X] T018 [US4] 테스트를 실행해 T016/T017이 통과하는지 확인 (Green). T007/T008이 이미 `null`→404, `ticketIdParamSchema`→400, `catch`→500을 구현했으므로 통과할 수 있다. 통과하면 회귀 방지 테스트로 유지하고, 실패하면 해당 분기만 수정한다.

**Checkpoint**: US4 완료 — 모든 User Story 독립 동작

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 검증과 마무리

- [X] T019 전체 검증: `npx tsc --noEmit`, `npm run test`(`--runInBand`, Jest가 스스로 종료되는지 포함), `npm run build`가 모두 통과하는지 확인 (constitution 품질 게이트, 커밋 전 체크리스트).
- [X] T020 [P] `specs/004-update-ticket-api/quickstart.md`의 curl 시나리오를 `npm run dev`로 실행해 기대 결과(200/400/404, `null` 비우기, 빈 body, JSON 형식 오류)와 일치하는지 확인. 확인 후 개발 서버는 Ctrl+C로 정상 종료한다(강제 종료 시 좀비 커넥션 위험, CLAUDE.md 원인 4).
- [X] T021 [P] 구현 정리: `console.log` 잔재 제거 확인, `docs/API_SPEC.md` §4와 contracts/update-ticket.md의 메시지·필드가 실제 구현과 일치하는지 대조, `src/client/`와 `src/shared/types`가 수정되지 않았는지 `git diff --stat`으로 확인.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 User Story를 막음 (T003 스키마가 핵심, T002 문서 정의는 테스트 작성 전에 완료)
- **User Stories (Phase 3~6)**: Foundational 완료 후. 우선순위 순(P1 → P2 → P2 → P3)으로 진행. US2~US4는 US1이 만든 `updateTicket`과 `PATCH` 핸들러 위에서 동작을 추가·검증하므로 **US1 완료 후** 진행한다
- **Polish (Phase 7)**: 원하는 User Story가 모두 끝난 후

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작. 서비스 함수와 PATCH 핸들러의 골격을 만든다
- **US2 (P2)**: US1의 서비스/핸들러를 재사용, 주로 테스트 추가(빈 SET 동작 검증이 핵심)
- **US3 (P2)**: US1의 핸들러에 JSON 파싱 실패 처리(T014)를 추가하는 유일한 라우트 수정
- **US4 (P3)**: US1이 구현한 404/INVALID_ID/500 분기를 테스트로 확정

### Within Each User Story

- 테스트 작성 → 실패 확인(Red) → 구현 → 통과 확인(Green) → 리팩터링
- 같은 파일(`__tests__/api/tickets.test.ts`, `__tests__/services/ticketService.test.ts`)을 수정하는 작업은 동시에 수행하지 않는다
- 각 Phase 체크포인트에서 검증한 뒤 다음으로 진행

### Parallel Opportunities

- US1: T004(서비스 테스트)와 T005(API 테스트)는 서로 다른 파일이라 병렬 가능
- US2: T010(서비스 테스트)과 T011(API 테스트) 병렬 가능
- US4: T016(서비스 테스트)과 T017(API 테스트) 병렬 가능
- Polish: T020, T021 병렬 가능 (T019 이후)

---

## Parallel Example: User Story 1

```text
# 서로 다른 파일의 테스트를 동시에 작성:
Task: "T004 [P] [US1] __tests__/services/ticketService.test.ts — updateTicket 서비스 테스트"
Task: "T005 [P] [US1] __tests__/api/tickets.test.ts — PATCH 통합 테스트(TC-API-004-01, 02, 12)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001) 완료
2. Phase 2: Foundational (T002~T003) 완료 — 스키마 준비
3. Phase 3: User Story 1 (T004~T009) 완료
4. **STOP and VALIDATE**: 유효한 부분 수정이 동작하는지 확인 (`updatedAt`, `isOverdue` 포함)
5. 이 시점에서 `PATCH`가 최소 동작하므로 필요하면 중간 커밋/데모

### Incremental Delivery

1. Setup + Foundational → 스키마 준비
2. US1 → 부분 수정 (MVP)
3. US2 → 값 비우기, 빈 요청 (Drizzle 빈 SET 동작 검증)
4. US3 → 검증 실패·잘못된 본문 거절
5. US4 → 404/INVALID_ID/500 확정
6. Polish → 빌드·수동 검증·정리

### Notes

- 커밋은 논리적 단위(예: 스키마+문서, US1, US2~US4 테스트 보강)로 나누고 메시지는 `[CL] feat: ...`, `[CL] test: ...`, `[CL] docs: ...` 형식을 따른다.
- 이 기능은 `status`/`position` 변경, 완료 처리, 삭제, 프론트엔드(`src/client/api/ticketApi.ts`, 수정 모달)를 포함하지 않는다.
- research.md의 "Drizzle 빈 SET 동작 미검증" 항목은 T010(d)/T011(TC-API-004-05)에서 확인되며, `updatedAt`을 항상 명시하는 T007 설계로 위험은 이미 회피되어 있다.
