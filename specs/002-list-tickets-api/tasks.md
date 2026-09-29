---

description: "Task list for GET /api/tickets implementation"
---

# Tasks: 티켓 목록 조회 API (보드)

**Input**: Design documents from `specs/002-list-tickets-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/get-tickets.md, research.md, quickstart.md

**Tests**: TEST_CASES.md에 TC-API-002-01~06, TC-API-008-02~05가 이미 명시되어 있고,
CLAUDE.md/constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트
작업을 포함한다.

**Organization**: 작업은 spec.md의 User Story(US1: 칸반 보드 현황 파악, US2: 마감 초과 인지)
단위로 그룹화한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1, US2)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입, 이번 기능은 변경 없음),
`src/server/`(백엔드 로직), `app/api/`(Route Handler, 기존 파일에 추가), `__tests__/`
(Jest, node 환경).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 이 기능 구현에 필요한 프로젝트 상태 확인 (신규 설정 없음 — 기존 Next.js/Jest/Drizzle
셋업과 `001-create-ticket-api`의 스키마·타입·헬퍼 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드
      작성 전 기준점 확보)

**Checkpoint**: 베이스라인 확인 완료 — User Story 구현 단계로 진행 (이번 기능은 Foundational
단계가 없음 — `001-create-ticket-api`에서 이미 `TICKET_STATUS`/`TicketWithMeta`/`BoardData`/
`COLUMN_ORDER` 타입과 `calculateIsOverdue()` 헬퍼가 구현되어 있어 재사용만 하면 됨)

---

## Phase 2: User Story 1 - 칸반 보드 현황 파악 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 보드를 조회하면 전체 티켓이 4개 상태(BACKLOG/TODO/IN_PROGRESS/DONE)로
그룹화되어, 각 칼럼 내 position 순서대로 반환된다. DONE 칼럼은 완료된 지 24시간 이내인
티켓만 포함한다.

**Independent Test**: 4개 상태에 걸쳐 티켓을 미리 생성해 둔 뒤 `GET /api/tickets`를 호출했을
때, 응답이 `{ BACKLOG, TODO, IN_PROGRESS, DONE }` 4개 키로 정확히 그룹화되고 각 칼럼 내
position 오름차순 정렬이 유지되는지 확인.

### Tests for User Story 1 (TDD — 구현 전에 작성하고 실패를 확인)

- [X] T002 [P] [US1] `__tests__/services/ticketService.test.ts`(`/** @jest-environment node */`)에
      `getBoardData()` 단위 테스트 작성: BACKLOG/TODO/IN_PROGRESS/DONE에 각 1개 이상 티켓이
      있을 때 응답이 4개 키로 그룹화되는지 검증 (TC-API-002-01 상당)
- [X] T003 [P] [US1] `__tests__/services/ticketService.test.ts`에 정렬 테스트 추가: 한 칼럼에
      `position` 값이 다른 티켓 3개가 있을 때 해당 칼럼 배열이 `position` 오름차순으로
      정렬되는지 검증 (TC-API-002-02)
- [X] T004 [P] [US1] `__tests__/services/ticketService.test.ts`에 빈 목록 테스트 추가: 티켓이
      0개일 때 `{ BACKLOG: [], TODO: [], IN_PROGRESS: [], DONE: [] }`가 반환되는지 검증
      (TC-API-002-03)
- [X] T005 [P] [US1] `__tests__/services/ticketService.test.ts`에 DONE 24시간 필터 테스트
      추가: `completedAt`이 1시간 전인 DONE 티켓은 `DONE` 배열에 포함되고(TC-API-002-04),
      `completedAt`이 25시간 전인 DONE 티켓은 `DONE` 배열을 포함한 어떤 칼럼에도 나타나지
      않는지(TC-API-002-05) 검증 (DATA_MODEL.md §5.4)
- [X] T006 [P] [US1] `__tests__/api/tickets.test.ts`(`/** @jest-environment node */`)에
      `GET /api/tickets` 통합 테스트 작성: 티켓이 없을 때 200 + 4개 빈 배열 키를 가진 응답이
      `docs/API_SPEC.md` §2 스키마와 일치하는지 검증 (TC-API-002-03 상당)
- [X] T007 [US1] `__tests__/api/tickets.test.ts`에 서버 오류 시나리오 테스트 추가:
      `jest.isolateModulesAsync` + `jest.doMock`으로 `ticketService.getBoardData`가 예외를
      던지도록 mock한 뒤 500 + `{error:{code:"INTERNAL_ERROR",message:"티켓 목록을
      불러오지 못했습니다"}}` 반환 확인 (TC-API-002-06). 기존 `POST` 서버 오류 테스트
      (`__tests__/api/tickets.test.ts`의 "POST /api/tickets - 서버 오류" describe 블록)와
      동일한 mock 패턴 재사용

### Implementation for User Story 1

- [X] T008 [US1] `src/server/services/ticketService.ts`에 `getBoardData(): Promise<BoardData>`
      구현: `tickets` 테이블 전체를 `status` → `position` 오름차순으로 Drizzle `select`
      (`idx_tickets_status_position` 인덱스 활용) → `COLUMN_ORDER`(`src/shared/types`에
      이미 정의됨) 기준 4개 상태 그룹으로 분류 → `DONE` 그룹은 `completedAt`이 현재 시각
      기준 24시간 이내인 행만 유지, 그 외 제외 → 각 행을 기존 `calculateIsOverdue()` 헬퍼로
      `isOverdue`를 계산해 `TicketWithMeta`로 변환 → `BoardData` 반환 (의존: 없음 — 기존
      스키마/타입/헬퍼 재사용, data-model.md 참조). `createTicket()`의 row→응답 매핑도
      `toTicketWithMeta()` 헬퍼로 추출해 중복 제거
- [X] T009 [US1] `app/api/tickets/route.ts`에 기존 `POST` 핸들러 옆에 `GET` 핸들러 추가:
      파라미터 없이 `ticketService.getBoardData()` 호출 → 성공 시 200 + `BoardData` 반환 →
      예기치 못한 예외는 500 + `{error:{code:"INTERNAL_ERROR",message:"티켓 목록을
      불러오지 못했습니다"}}` 응답 (의존: T008, contracts/get-tickets.md 참조 — `POST`와
      다른 500 메시지임에 주의)
- [X] T010 [US1] T002~T007의 모든 테스트가 통과하는지
      `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts`로
      확인 (Green 단계) — 26개 테스트 전부 통과

**Checkpoint**: User Story 1 완전히 동작 — 보드 조회(그룹화/정렬/빈 목록/24시간 필터/서버
오류)가 독립적으로 테스트 가능한 상태. 이 시점에 이미 실사용 가능한 MVP.

---

## Phase 3: User Story 2 - 마감 초과 인지 (Priority: P2)

**Goal**: 사용자가 보드를 조회하면 완료되지 않았고 종료예정일이 지난 티켓에 지연(isOverdue)
표시가 함께 내려온다. DONE 상태이거나 종료예정일이 없는 티켓은 지연 표시되지 않는다.

**Independent Test**: 종료예정일이 과거인 티켓을 BACKLOG/TODO/IN_PROGRESS/DONE 각 상태로
만들어 조회했을 때, DONE만 제외하고 나머지는 모두 `isOverdue=true`로 계산되는지 확인.

### Tests for User Story 2

- [X] T011 [P] [US2] `__tests__/api/tickets.test.ts`에 오버듀 판정 테스트 추가: BACKLOG
      상태에서 `dueDate`가 어제인 티켓 조회 시 `isOverdue=true`(TC-API-008-02), TODO
      상태에서 동일 조건 `isOverdue=true`(TC-API-008-03), IN_PROGRESS 상태에서 동일 조건
      `isOverdue=true`(TC-API-008-04) 검증 — BACKLOG도 다른 칼럼과 동일하게 판정 대상임을
      확인 (DATA_MODEL.md §5.3) — `it.each`로 3개 상태를 한 번에 검증 (T006/T007과 같은
      작업에서 함께 작성됨)
- [X] T012 [P] [US2] `__tests__/api/tickets.test.ts`에 DONE 우선 적용 테스트 추가: DONE
      상태에서 `dueDate`가 어제인 티켓 조회 시 `isOverdue=false`가 되는지 검증
      (TC-API-008-05 — `status===DONE`이면 `dueDate`가 과거여도 무조건 `false`인 판정식
      우선순위 확인)

### Implementation for User Story 2

- [X] T013 [US2] T008의 `getBoardData()`가 재사용하는 `calculateIsOverdue()`가 BACKLOG/TODO/
      IN_PROGRESS/DONE 4개 상태 모두에서 판정식(`status !== 'DONE' && dueDate 존재 &&
      dueDate < now`)을 올바르게 적용하는지 점검하고 필요 시 보완 (`001-create-ticket-api`에서
      이미 구현된 헬퍼 재사용 — 별도 파일 신설 없음) — T011/T012 테스트 통과로 4개 상태
      모두 정상 동작 확인, 코드 수정 불필요
- [X] T014 [US2] T011~T012의 모든 테스트가 통과하는지
      `npm run test -- __tests__/api/tickets.test.ts`로 확인 (Green 단계) — 통과 확인 완료

**Checkpoint**: User Story 1과 User Story 2 모두 독립적으로 동작 — 보드 조회와 오버듀 판정이
모든 상태·엣지케이스에서 완비된 상태.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 두 User Story에 공통으로 영향을 미치는 마무리 작업

- [X] T015 `npx tsc --noEmit`으로 전체 타입 체크 통과 확인 (constitution 원칙 I)
- [X] T016 `npm run lint`로 ESLint 통과 확인, `console.log` 잔존 여부 확인
- [X] T017 `specs/002-list-tickets-api/quickstart.md`의 curl 시나리오를 `npm run dev` 실행
      상태에서 수동 재현하여 실제 응답이 문서와 일치하는지 확인 (그룹화/24시간 필터는 curl로
      재현 불가 — 자동 테스트로만 검증됨을 확인) — 빈 목록/생성 후 그룹화/오버듀 미표시 3개
      시나리오 모두 문서와 일치 확인
- [X] T018 `npm run build`로 프로덕션 빌드 성공 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작 가능
- **User Story 1 (Phase 2)**: Setup 완료 후 시작 가능. Foundational 단계 없음 — 필요한
  타입(`BoardData`, `COLUMN_ORDER`, `TicketWithMeta`)과 헬퍼(`calculateIsOverdue`)가
  `001-create-ticket-api`에서 이미 구현되어 있음
- **User Story 2 (Phase 3)**: User Story 1 완료 후 시작 권장. `getBoardData()`(T008)가
  존재해야 오버듀 판정을 조회 결과로 검증할 수 있으므로 실질적으로 US1 구현 완료가
  선행되어야 함
- **Polish (Phase 4)**: US1, US2 모두 완료 후 진행

### Within Each User Story

- 테스트(T002~T007, T011~T012)를 먼저 작성하고 실패를 확인한 뒤 구현(T008~T009, T013)을
  진행한다 (Red → Green)
- 서비스 레이어(T008) 완료 후 Route Handler(T009) 작성 (constitution 원칙 V: 계층 순서)

### Parallel Opportunities

- T002~T006은 각각 다른 assertion을 다루므로 [P] 병렬 작성 가능하나 같은 파일
  (`ticketService.test.ts` 또는 `tickets.test.ts`)에 쓰는 경우 병합 시 주의
- T011~T012도 동일하게 [P] 가능 (같은 파일, 다른 assertion)

---

## Parallel Example: User Story 1

```bash
# T002~T006을 병렬로 작성 (서로 다른 assertion, 파일 충돌 시 순차 병합)
Task: "getBoardData() 4컬럼 그룹화 테스트 in __tests__/services/ticketService.test.ts"
Task: "position 정렬 테스트 in __tests__/services/ticketService.test.ts"
Task: "빈 목록 테스트 in __tests__/services/ticketService.test.ts"
Task: "DONE 24시간 필터 테스트 in __tests__/services/ticketService.test.ts"
Task: "GET 통합 테스트(빈 목록) in __tests__/api/tickets.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: User Story 1 완료 (보드 조회 — 그룹화/정렬/빈 목록/24시간 필터/서버 오류)
3. **STOP and VALIDATE**: User Story 1을 독립적으로 테스트 — 이 시점에 이미 실사용 가능한
   최소 기능(오버듀 표시 없이도 보드 자체는 조회 가능)
4. 필요 시 배포/데모

### Incremental Delivery

1. Setup 완료 → 기반 준비 (Foundational 단계 없음, `001-create-ticket-api` 재사용)
2. User Story 1 추가 → 독립 테스트 → 배포/데모 (MVP!)
3. User Story 2 추가 → 독립 테스트 → 배포/데모
4. Polish 단계로 마무리

---

## Notes

- [P] 작업 = 서로 다른 파일 또는 서로 다른 관심사, 의존성 없음
- [Story] 라벨은 작업을 특정 User Story에 추적 가능하게 매핑
- 테스트는 구현 전에 작성하고 실패를 먼저 확인한다 (constitution 개발 워크플로우: TDD
  Red→Green→Refactor)
- 작업 완료마다 또는 논리적 단위로 커밋
- 각 체크포인트에서 멈춰 해당 스토리를 독립적으로 검증할 수 있다
- `route.ts`(T009)에 비즈니스 로직을 직접 작성하지 않는다 (constitution 원칙 V) — 그룹화,
  정렬, 24시간 필터, isOverdue 계산은 반드시 `ticketService.ts`에 위치
- 이번 기능은 `001-create-ticket-api`에서 구현된 `TICKET_STATUS`, `TicketWithMeta`,
  `BoardData`, `COLUMN_ORDER`, `calculateIsOverdue()`를 그대로 재사용하며 새로 만들지
  않는다 (research.md, data-model.md 참조)
