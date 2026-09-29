---

description: "Task list for GET /api/tickets/:id implementation"
---

# Tasks: 티켓 상세 조회 API

**Input**: Design documents from `specs/003-get-ticket-detail/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/get-ticket-detail.md, research.md, quickstart.md

**Tests**: `docs/TEST_CASES.md`에 TC-API-003-01~06이 이미 명시되어 있고, CLAUDE.md/
constitution.md가 TDD(Red→Green→Refactor)를 필수 규칙으로 요구하므로 테스트 작업을
포함한다.

**Organization**: 작업은 spec.md의 User Story(US1: 티켓 상세 정보 확인, US2: 존재하지
않는 항목 조회 시 안내, US3: 잘못된 형식의 식별자 요청 처리) 단위로 그룹화한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 이 작업이 속한 사용자 스토리 (US1, US2, US3)
- 각 작업에 정확한 파일 경로 포함

## Path Conventions

CLAUDE.md/TRD.md의 3계층 구조를 따른다: `src/shared/`(공유 타입·검증 스키마),
`src/server/`(백엔드 로직), `app/api/`(Route Handler, 신규 동적 라우트), `__tests__/`
(Jest, node 환경).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 이 기능 구현에 필요한 프로젝트 상태 확인 (신규 설정 없음 — 기존
Next.js/Jest/Drizzle 셋업과 `001`/`002`의 스키마·타입·헬퍼 재사용)

- [X] T001 `npx tsc --noEmit`, `npm run test`로 현재 베이스라인이 깨끗한지 확인 (신규 코드
      작성 전 기준점 확보)

**Checkpoint**: 베이스라인 확인 완료 — Foundational 단계로 진행

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 의존하는 id 검증 스키마. 이 스키마 없이는 어떤
User Story도(정상 조회조차) 구현할 수 없으므로 먼저 완료한다.

**⚠️ CRITICAL**: 이 Phase 완료 전에는 User Story 작업을 시작할 수 없음

- [X] T002 `src/shared/validations/ticket.ts`에 `ticketIdParamSchema` 추가:
      `z.coerce.number().int().positive()`로 경로 파라미터 `id`(문자열)를 양의 정수로
      검증 (data-model.md, research.md "id 검증" 결정 참조. constitution 원칙 IV: 서비스
      레이어 진입 전 Zod 검증 필수)

**Checkpoint**: id 검증 스키마 준비 완료 — User Story 구현 단계로 진행

---

## Phase 3: User Story 1 - 티켓 상세 정보 확인 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 유효한 id로 상세 조회를 요청하면, 해당 티켓의 전체 필드(`isOverdue`
포함)가 반환된다. 완료된 지 24시간이 지나 목록에서는 보이지 않는 DONE 티켓도 상세
조회로는 정상 조회된다.

**Independent Test**: 상세 정보가 채워진 티켓을 하나 만든 뒤 해당 id로
`GET /api/tickets/:id`를 호출했을 때, 모든 필드가 정확히 반환되는지 확인. 완료된 지
25시간 지난 DONE 티켓도 동일하게 정상 조회되는지 확인.

### Tests for User Story 1 (TDD — 구현 전에 작성하고 실패를 확인)

- [X] T003 [P] [US1] `__tests__/services/ticketService.test.ts`
      (`/** @jest-environment node */`)에 `getTicketById()` 단위 테스트 작성: 존재하는
      id로 조회 시 전체 필드와 `isOverdue`가 포함된 `TicketWithMeta`가 반환되는지 검증
      (TC-API-003-01)
- [X] T004 [P] [US1] `__tests__/services/ticketService.test.ts`에 24시간 경과 DONE 티켓
      테스트 추가: `completedAt`이 25시간 전인 DONE 티켓도 `getTicketById()`로 정상
      반환되는지 검증 — `getBoardData()`의 24시간 숨김 필터가 이 함수에는 적용되지
      않음을 확인 (TC-API-003-02, research.md "24시간 필터 미적용" 결정)
- [X] T005 [P] [US1] `__tests__/api/tickets.test.ts`(`/** @jest-environment node */`)에
      `GET /api/tickets/:id` 통합 테스트 작성: 생성된 티켓의 id로 조회 시 200 + 전체
      필드가 `docs/API_SPEC.md` §3 스키마와 일치하는지 검증 (TC-API-003-01),
      완료된 지 25시간 지난 DONE 티켓도 200으로 조회되는지 검증 (TC-API-003-02)
- [X] T006 [US1] `__tests__/api/tickets.test.ts`에 서버 오류 시나리오 테스트 추가:
      `jest.isolateModulesAsync` + `jest.doMock`으로 `ticketService.getTicketById`가
      예외를 던지도록 mock한 뒤 500 +
      `{error:{code:"INTERNAL_ERROR",message:"티켓을 불러오지 못했습니다"}}` 반환 확인
      (contracts/get-ticket-detail.md 500 응답 참조). 기존 `GET /api/tickets` 서버 오류
      테스트와 동일한 mock 패턴 재사용

### Implementation for User Story 1

- [X] T007 [US1] `src/server/services/ticketService.ts`에
      `getTicketById(id: number): Promise<TicketWithMeta | null>` 구현: `tickets`
      테이블에서 `id`(PK)로 Drizzle `where(eq(tickets.id, id))` 단건 조회 → 행이 없으면
      `null` 반환 → 행이 있으면 기존 `toTicketWithMeta()` 헬퍼로 변환해 반환. `DONE`
      24시간 필터는 적용하지 않는다 (의존: T002 불필요 — 이 함수는 검증된 id만 받음,
      data-model.md 참조)
- [X] T008 [US1] `app/api/tickets/[id]/route.ts` 신규 생성: `GET` 핸들러 작성 —
      Next.js 16 동적 세그먼트(`params: Promise<{ id: string }>`)에서 `id`를 꺼내
      `ticketIdParamSchema`(T002)로 검증 → 실패 시 400
      `{error:{code:"INVALID_ID",message:"유효하지 않은 티켓 ID입니다"}}` → 검증 성공 시
      `ticketService.getTicketById(id)`(T007) 호출 → `null`이면 404
      `{error:{code:"TICKET_NOT_FOUND",message:"존재하지 않거나 삭제된
      티켓입니다"}}` → 값이 있으면 200 + `TicketWithMeta` 반환 → 예기치 못한 예외는 500
      `{error:{code:"INTERNAL_ERROR",message:"티켓을 불러오지 못했습니다"}}` (의존: T002,
      T007, contracts/get-ticket-detail.md 참조)
- [X] T009 [US1] T003~T006의 모든 테스트가 통과하는지
      `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts --runInBand`로
      확인 (Green 단계)

**Checkpoint**: User Story 1 완전히 동작 — 정상 조회(전체 필드/24시간 경과 DONE
포함)와 서버 오류 처리가 독립적으로 테스트 가능한 상태. 이 시점에 이미 실사용 가능한
MVP.

---

## Phase 4: User Story 2 - 존재하지 않는 항목 조회 시 안내 (Priority: P2)

**Goal**: 존재하지 않거나 삭제된 id로 조회하면 명확한 404 `TICKET_NOT_FOUND` 응답을
받는다.

**Independent Test**: 존재하지 않는 id(예: `999999`)로 `GET /api/tickets/:id`를 호출했을
때 404와 명확한 에러 메시지가 반환되는지 확인.

### Tests for User Story 2

- [X] T010 [P] [US2] `__tests__/services/ticketService.test.ts`에 `getTicketById()` 존재
      하지 않는 id 테스트 추가: 존재하지 않는 id로 조회 시 `null`을 반환하는지 검증
      (TC-API-003-05)
- [X] T011 [P] [US2] `__tests__/api/tickets.test.ts`에 404 통합 테스트 추가: 존재하지
      않는 id(`999999`)로 조회 시 404 +
      `{error:{code:"TICKET_NOT_FOUND",message:"존재하지 않거나 삭제된
      티켓입니다"}}` 반환 확인 (TC-API-003-05, TC-API-003-06 — 소프트 삭제가 아직
      미구현이므로 "삭제된 티켓"은 "존재하지 않는 id"와 동일 케이스로 검증, spec.md
      Assumptions 참조)

### Implementation for User Story 2

- [X] T012 [US2] T007(`getTicketById`)과 T008(Route Handler의 404 분기)이 이미
      존재하지 않는 id를 올바르게 처리하는지 T010~T011 테스트로 확인 — 별도 신규 구현
      불필요 (US1 구현에 이미 포함된 분기를 이 Phase에서 명시적으로 검증)
- [X] T013 [US2] T010~T011의 모든 테스트가 통과하는지
      `npm run test -- __tests__/services/ticketService.test.ts __tests__/api/tickets.test.ts --runInBand`로
      확인 (Green 단계)

**Checkpoint**: User Story 1과 User Story 2 모두 독립적으로 동작 — 정상 조회와 "찾을 수
없음" 처리가 완비된 상태.

---

## Phase 5: User Story 3 - 잘못된 형식의 식별자 요청 처리 (Priority: P3)

**Goal**: id가 숫자가 아니거나 양의 정수가 아니면 400 `INVALID_ID` 응답을 받는다.

**Independent Test**: `id="abc"`, `id=0`, `id=-1`로 각각 조회했을 때 400과 명확한 에러
메시지가 반환되는지 확인.

### Tests for User Story 3

- [X] T014 [P] [US3] `__tests__/api/tickets.test.ts`에 400 통합 테스트 추가:
      `id="abc"`(정수 아님), `id=0`, `id=-1`(양의 정수 아님) 각각에 대해 400 +
      `{error:{code:"INVALID_ID",message:"유효하지 않은 티켓 ID입니다"}}` 반환 확인
      (TC-API-003-03, TC-API-003-04) — `it.each`로 세 케이스를 한 번에 검증

### Implementation for User Story 3

- [X] T015 [US3] T002(`ticketIdParamSchema`)와 T008(Route Handler의 400 분기)이 이미
      잘못된 형식의 id를 올바르게 처리하는지 T014 테스트로 확인 — 별도 신규 구현 불필요
      (Foundational/US1 구현에 이미 포함된 검증을 이 Phase에서 명시적으로 검증)
- [X] T016 [US3] T014의 테스트가 통과하는지
      `npm run test -- __tests__/api/tickets.test.ts --runInBand`로 확인 (Green 단계)

**Checkpoint**: User Story 1, 2, 3 모두 독립적으로 동작 — 정상 조회/찾을 수 없음/잘못된
요청 처리가 모든 엣지케이스에서 완비된 상태.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 세 User Story에 공통으로 영향을 미치는 마무리 작업

- [X] T017 `npx tsc --noEmit`으로 전체 타입 체크 통과 확인 (constitution 원칙 I)
- [X] T018 `npm run lint`로 ESLint 통과 확인, `console.log` 잔존 여부 확인
- [X] T019 `specs/003-get-ticket-detail/quickstart.md`의 curl 시나리오를 `npm run dev`
      실행 상태에서 수동 재현하여 실제 응답이 문서와 일치하는지 확인 (24시간 경과 DONE
      조회는 curl로 재현 불가 — 자동 테스트로만 검증됨을 확인) — 정상 조회/400
      INVALID_ID/404 TICKET_NOT_FOUND 3개 시나리오 모두 문서와 일치 확인
- [X] T020 `npm run build`로 프로덕션 빌드 성공 확인 — `/api/tickets/[id]` 동적 라우트
      정상 인식 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 시작. **모든 User Story를 차단** — id 검증
  스키마(T002)가 없으면 Route Handler의 400 분기를 구현할 수 없음
- **User Story 1 (Phase 3)**: Foundational 완료 후 시작 가능. 다른 스토리에 의존하지 않음
- **User Story 2 (Phase 4)**: Foundational 완료 후 시작 가능하나, 실질적으로 US1의
  `getTicketById`/Route Handler(T007, T008)가 이미 404 분기를 포함하므로 US1 완료 후
  진행 권장
- **User Story 3 (Phase 5)**: Foundational 완료 후 시작 가능하나, 실질적으로 US1의 Route
  Handler(T008)가 이미 400 분기를 포함하므로 US1 완료 후 진행 권장
- **Polish (Phase 6)**: US1, US2, US3 모두 완료 후 진행

### Within Each User Story

- 테스트(T003~T006, T010~T011, T014)를 먼저 작성하고 실패를 확인한 뒤 구현(T007~T008)을
  진행한다 (Red → Green)
- 서비스 레이어(T007) 완료 후 Route Handler(T008) 작성 (constitution 원칙 V: 계층 순서)

### Parallel Opportunities

- T003~T005는 각각 다른 assertion을 다루므로 [P] 병렬 작성 가능하나 같은 파일
  (`ticketService.test.ts` 또는 `tickets.test.ts`)에 쓰는 경우 병합 시 주의
- T010~T011, T014도 동일하게 [P] 가능 (같은 파일, 다른 assertion)

---

## Parallel Example: User Story 1

```bash
# T003~T005를 병렬로 작성 (서로 다른 assertion, 파일 충돌 시 순차 병합)
Task: "getTicketById() 정상 조회 테스트 in __tests__/services/ticketService.test.ts"
Task: "getTicketById() 24시간 경과 DONE 테스트 in __tests__/services/ticketService.test.ts"
Task: "GET /api/tickets/:id 통합 테스트 in __tests__/api/tickets.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (id 검증 스키마)
3. Phase 3: User Story 1 완료 (정상 상세 조회 — 전체 필드/24시간 경과 DONE/서버 오류)
4. **STOP and VALIDATE**: User Story 1을 독립적으로 테스트 — 이 시점에 이미 실사용
   가능한 최소 기능(잘못된 요청/존재하지 않는 id에 대한 명시적 안내는 없어도 정상
   조회는 동작)
5. 필요 시 배포/데모

### Incremental Delivery

1. Setup + Foundational 완료 → id 검증 기반 준비
2. User Story 1 추가 → 독립 테스트 → 배포/데모 (MVP!)
3. User Story 2 추가 → 독립 테스트 → 배포/데모
4. User Story 3 추가 → 독립 테스트 → 배포/데모
5. Polish 단계로 마무리

---

## Notes

- [P] 작업 = 서로 다른 파일 또는 서로 다른 관심사, 의존성 없음
- [Story] 라벨은 작업을 특정 User Story에 추적 가능하게 매핑
- 테스트는 구현 전에 작성하고 실패를 먼저 확인한다 (constitution 개발 워크플로우: TDD
  Red→Green→Refactor)
- 작업 완료마다 또는 논리적 단위로 커밋
- 각 체크포인트에서 멈춰 해당 스토리를 독립적으로 검증할 수 있다
- `route.ts`(T008)에 비즈니스 로직을 직접 작성하지 않는다 (constitution 원칙 V) — id
  검증은 Zod 스키마(T002)에, 조회 로직은 `ticketService.ts`(T007)에 위치
- `getBoardData()`(002에서 구현됨)의 DONE 24시간 숨김 필터는 이 기능(`getTicketById`)에
  적용하지 않는다 — 목록과 상세 조회는 서로 다른 가시성 규칙을 가진다 (research.md
  참조)
- 소프트 삭제(`deletedAt` 등)는 아직 스키마에 없으므로, "삭제된 티켓"은 "존재하지 않는
  id"와 동일하게 처리된다 (spec.md Assumptions, T011/T012 참조)
