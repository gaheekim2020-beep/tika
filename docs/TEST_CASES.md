# Tika - 테스트 케이스 명세 (TEST_CASES.md)

> REQUIREMENTS.md(FR/NFR/US), API_SPEC.md, DATA_MODEL.md, COMPONENT_SPEC.md를 기준으로 작성한다.
> API 테스트 TC ID는 REQUIREMENTS.md §4 추적 매트릭스의 `TC-{FR 번호}-{일련번호}` 규칙에 `API` 접두사를 붙여 `TC-API-{FR 번호}-{일련번호}`로 표기한다 (컴포넌트/통합 테스트와 구분하기 위함). 컴포넌트 테스트는 `TC-COMP-`, 통합 테스트는 `TC-INT-` 접두사를 사용한다. 화면 아래 계층의 클라이언트 로직 테스트는 API 호출 함수 `TC-CLIENT-API-`, 순수 로직 `TC-CLIENT-UTIL-`, 훅 `TC-HOOK-` 접두사를 사용한다.
> TDD 순서(CLAUDE.md): 이 문서의 테스트 케이스 확인 → 테스트 코드 작성(Red) → 최소 구현(Green) → 리팩토링.

---

## 0. 추적 매트릭스 (Traceability Matrix)

> REQUIREMENTS.md §4 추적 매트릭스에서 출발한 표다. 그 표의 "예정 TC ID"는 이 문서가 작성되기 전 예약해 둔 자리였고, 실제 작성 결과 API 테스트만 26개에서 90개 가까이로 늘었으며 컴포넌트 테스트(TC-COMP-)와 통합 테스트(TC-INT-)라는 두 계층이 새로 생겼다. 아래 표는 그 확장된 결과를 반영해 이 문서 안에서 다시 정리한 최종 매트릭스다.

| US | 관련 FR | 관련 NFR | API TC | 컴포넌트 TC | 통합 TC |
|----|---------|----------|--------|-------------|---------|
| US-001 새 할 일 등록 | FR-001 | - | TC-API-001-01~02, 07~08 | TC-COMP-005-02, TC-COMP-006-03, 06 | TC-INT-001-01, 03 |
| US-002 상세 정보 설정 | FR-001 | - | TC-API-001-02, 05~06, 09~12, TC-API-008-01 | TC-COMP-006-01, 04, 07 | TC-INT-001-02 |
| US-003 칸반 보드 현황 파악 | FR-002, FR-008 | NFR-001, NFR-002 | TC-API-002-01~03, TC-API-008-02~05 | TC-COMP-002-01~03, TC-COMP-003-01, 08~10, TC-COMP-004-01~04 | TC-INT-002-01, 03 |
| US-004 마감 초과 인지 | FR-008 | - | TC-API-008-02~09 | TC-COMP-001-04~05 | TC-INT-002-02 |
| US-005 드래그앤드롭 상태 변경 | FR-007 | NFR-003, NFR-004 | TC-API-007-01~04, 11~14 | TC-COMP-003-02~03, 05~07, 11~14 | TC-INT-003-04, 06 |
| US-006 할 일 완료 처리 | FR-005, FR-007 | - | TC-API-005-01~13, TC-API-007-05~10, TC-API-008-09 | TC-COMP-001-10~11, TC-COMP-003-04 | TC-INT-003-01~03, 05 |
| US-007 할 일 수정 | FR-003, FR-004 | - | TC-API-003-01~06, TC-API-004-01~18, TC-API-008-06~08 | TC-COMP-001-08~09, TC-COMP-007-01~12 | TC-INT-004-01~02 |
| US-008 할 일 삭제 | FR-006 | - | TC-API-006-01~11 | TC-COMP-008-01~06 | TC-INT-005-01~04 |

- NFR-001(성능)은 US-003 보드 초기 로드에 관련되나 별도 성능 측정 테스트(Lighthouse 등)가 필요해 이 문서의 기능 테스트 케이스로는 커버하지 않는다.
- NFR-002(반응형)는 §3.3 Board의 TC-COMP-003-08~10(데스크톱/태블릿/모바일 배치)이 담당한다.
- NFR-003(접근성)은 각 컴포넌트 섹션에 개별적으로 흩어져 있다 (키보드 조작 TC-COMP-003-07/11, ESC 처리 TC-COMP-007-11 등). US-005(드래그앤드롭)에서만 대표로 표기했다.
- NFR-004(데이터 무결성)는 두 축으로 나뉜다. "낙관적 업데이트: UI 즉시 반영 → 실패 시 롤백"은 TC-COMP-003-12(드롭 실패 시 조용히 롤백)와 TC-INT-003-06(네트워크 오류 시 롤백 + DB 상태 불변 확인)이 담당하고, "position 충돌 시 재정렬"은 TC-API-007-04, "트랜잭션 원자성"은 TC-API-007-14가 별도로 담당한다.
- TC-COMP-009(Modal/Badge/Button 공통 primitive)는 특정 US 하나에 속하지 않고 여러 US에 걸쳐 재사용되는 기반 컴포넌트라 위 표에는 넣지 않았다. Modal은 US-001/002/007(생성·수정 모달), Badge는 US-002/004(우선순위·지연 표시), Button은 거의 모든 US의 버튼형 UI에 간접적으로 걸쳐 있다.
- TC-COMP-010~013(ConfirmDialog·상태 표시·ErrorToast·배지 단독)과 TC-CLIENT-API / TC-CLIENT-UTIL / TC-HOOK(§3.14~3.17)은 화면 아래 계층이거나 여러 US에 걸쳐 재사용되는 기반이라 위 표에 넣지 않았다 (TC-COMP-009와 같은 이유). NFR-004의 낙관적 업데이트·롤백은 컴포넌트 TC 외에 TC-HOOK-001-07~09, 14~16이 직접 검증한다.

---

## 1. 테스트 범위 구성

| 구분 | 대상 | 위치(예정) | 관점 |
|------|------|------|------|
| 1. API 테스트 | `app/api/` Route Handler + `src/server/services/` | `__tests__/services/`, `__tests__/api/tickets*.test.ts` (`/** @jest-environment node */`) | 백엔드 — 요청/응답, 상태 코드, DB 부수효과 |
| 2. 컴포넌트 테스트 | `src/client/components/` | `__tests__/components/` (jsdom) | 사용자 관점 — 화면에 보이는 것과 사용자의 조작 |
| 2-1. 클라이언트 로직 테스트 | `src/client/api/ticketApi.ts`, `src/client/lib/`, `src/client/hooks/` | `__tests__/api/ticketApi.test.ts`, `__tests__/lib/`, `__tests__/hooks/` (jsdom) | 개발자 관점 — 요청 형식, 반환값, 상태 변화 (화면 아래 계층) |
| 3. 통합 테스트 | 사용자 스토리(US) 단위 End-to-End 흐름 | `__tests__/integration/` | 사용자 시나리오 전체 — 여러 컴포넌트/API 호출이 이어지는 흐름 |

---

## 2. API 테스트 케이스 (백엔드)

> 백엔드 관점. Route Handler(`app/api/`) → 서비스(`src/server/services/`) → DB(Drizzle)까지의 요청/응답을 검증한다.
> 각 표는 "정상 케이스"와 "예외 케이스"로 구분한다.

### 2.1 `POST /api/tickets` — 티켓 생성 (FR-001)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-001-01 | 필수 필드(제목)만으로 생성 | `{ title: "새 업무" }` | 201, `status="BACKLOG"`, `priority="MEDIUM"`, `position`은 BACKLOG 칼럼 최솟값 - 1024, `isOverdue=false` |
| TC-API-001-02 | 모든 필드를 채워 생성 | `{ title, description, priority: "HIGH", plannedStartDate, dueDate: 내일 }` | 201, 입력값 그대로 반영된 티켓 반환, `createdAt`/`updatedAt` 현재 시각으로 자동 설정 |
| TC-API-001-03 | BACKLOG 칼럼이 비어있는 상태에서 생성 | BACKLOG에 티켓 0개 | 201, `position=1024` |
| TC-API-001-04 | BACKLOG에 기존 티켓이 있는 상태에서 생성 | 기존 최솟값 `position=1024`인 티켓 존재 | 201, 새 티켓 `position = 1024 - 1024 = 0` (기존 최솟값보다 작은 값, 맨 위 배치) |
| TC-API-001-05 | `description` 미입력 | `description` 필드 생략 | 201, 응답의 `description=null` |
| TC-API-001-06 | `priority` 미입력 | `priority` 필드 생략 | 201, 응답의 `priority="MEDIUM"` (기본값) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-001-07 | 제목 누락 | `title` 필드 자체가 없음 | 400, `error.code="VALIDATION_ERROR"`, `error.field="title"`, `error.message="제목을 입력해주세요"` |
| TC-API-001-08 | 제목이 공백만으로 구성 | `title="   "` | 400, `error.code="VALIDATION_ERROR"`, `error.field="title"`, `error.message="제목을 입력해주세요"` |
| TC-API-001-09 | 제목 200자 초과 | `title`이 201자 | 400, `error.field="title"`, `error.message="제목은 200자 이내로 입력해주세요"` |
| TC-API-001-10 | 설명 1000자 초과 | `description`이 1001자 | 400, `error.field="description"`, `error.message="설명은 1000자 이내로 입력해주세요"` |
| TC-API-001-11 | 잘못된 우선순위 값 | `priority="URGENT"` (허용값 외) | 400, `error.field="priority"`, `error.message="우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요"` |
| TC-API-001-12 | 과거 종료예정일 | `dueDate` = 어제 날짜 | 400, `error.field="dueDate"`, `error.message="종료예정일은 오늘 이후 날짜를 선택해주세요"` |
| TC-API-001-13 | DB 오류 등 예상치 못한 서버 오류 | 서비스 계층에서 예외 발생(mock) | 500, `error.code="INTERNAL_ERROR"` |
| TC-API-001-14 | 요청 본문이 JSON이 아니거나 객체가 아님 | body=`not json` 또는 `[]` | 400, `error.code="VALIDATION_ERROR"`, `error.field` 없음, `error.message="요청 본문이 올바른 JSON 형식이 아닙니다"` |

---

### 2.2 `GET /api/tickets` — 티켓 목록 조회 (FR-002, FR-008)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-002-01 | 4개 상태에 티켓이 골고루 있는 상태에서 조회 | BACKLOG/TODO/IN_PROGRESS/DONE에 각 1개 이상 존재 | 200, 응답이 `{ BACKLOG, TODO, IN_PROGRESS, DONE }` 4개 키로 그룹화됨 |
| TC-API-002-02 | 같은 칼럼 내 여러 티켓 조회 | 한 칼럼에 `position` 값이 다른 티켓 3개 | 200, 해당 칼럼 배열이 `position` 오름차순으로 정렬됨 |
| TC-API-002-03 | 티켓이 하나도 없는 상태에서 조회 | 전체 티켓 0개 | 200, `{ BACKLOG: [], TODO: [], IN_PROGRESS: [], DONE: [] }` |
| TC-API-002-04 | `completedAt`이 24시간 이내인 DONE 티켓 조회 | `status="DONE"`, `completedAt`=1시간 전 | 200, `DONE` 배열에 포함됨 |
| TC-API-002-05 | `completedAt`이 24시간을 초과한 DONE 티켓 조회 | `status="DONE"`, `completedAt`=25시간 전 | 200, `DONE` 배열에서 제외됨 (다른 칼럼 배열에도 나타나지 않음) |
| TC-API-002-07 | 같은 칼럼에서 `position`이 같은 티켓 조회 | 한 칼럼에 `position`이 같은 티켓 2개 (삽입 순서와 `id` 순서가 반대) | 200, 해당 칼럼 배열이 `id` 오름차순 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-002-06 | DB 연결 실패 등 서버 오류 | 서비스 계층에서 예외 발생(mock) | 500, `error.code="INTERNAL_ERROR"`, `error.message="티켓 목록을 불러오지 못했습니다"` |

---

### 2.3 `GET /api/tickets/:id` — 티켓 상세 조회 (FR-003)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-003-01 | 존재하는 티켓 ID로 조회 | 사전에 생성된 티켓의 `id` | 200, 해당 티켓의 전체 필드(`isOverdue` 포함) 반환 |
| TC-API-003-02 | 24시간이 지난 DONE 티켓을 단건으로 조회 | `status="DONE"`, `completedAt`=25시간 전 (보드 목록에서는 제외된 상태) | 200, 정상 조회됨 (하드 삭제되지 않으므로 단건 조회는 가능) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-003-03 | ID가 정수가 아님 | `id="abc"` | 400, `error.code="INVALID_ID"`, `error.message="유효하지 않은 티켓 ID입니다"` |
| TC-API-003-04 | ID가 음수 또는 0 | `id=-1` 또는 `id=0` | 400, `error.code="INVALID_ID"` |
| TC-API-003-05 | 존재하지 않는 ID로 조회 | DB에 없는 `id=999999` | 404, `error.code="TICKET_NOT_FOUND"`, `error.message="존재하지 않거나 삭제된 티켓입니다"` |
| TC-API-003-06 | 이미 삭제된 티켓 ID로 조회 | 삭제된 티켓의 `id` | 404, `error.code="TICKET_NOT_FOUND"` |

---

### 2.4 `PATCH /api/tickets/:id` — 티켓 수정 (FR-004)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-004-01 | 제목만 수정 | `{ title: "수정된 제목" }` | 200, `title`만 변경되고 나머지 필드는 기존값 유지, `updatedAt` 갱신 |
| TC-API-004-02 | 여러 필드 동시 수정 | `{ title, description, priority, plannedStartDate, dueDate }` | 200, 전달된 필드 모두 반영 |
| TC-API-004-03 | `description`을 `null`로 명시적 초기화 | 기존 `description`이 있는 티켓에 `{ description: null }` | 200, `description=null`로 갱신됨 |
| TC-API-004-04 | `plannedStartDate`를 `null`로 명시적 초기화 | 기존 `plannedStartDate`가 있는 티켓에 `{ plannedStartDate: null }` | 200, `plannedStartDate=null`로 갱신됨 |
| TC-API-004-05 | 필드를 아예 전달하지 않음(빈 body) | `{}` | 200, 기존 값 그대로 유지, `updatedAt`만 갱신 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-004-06 | 제목을 공백만으로 수정 | `{ title: "   " }` | 400, `error.field="title"`, `error.message="제목을 입력해주세요"` |
| TC-API-004-07 | 제목 200자 초과로 수정 | `title`이 201자 | 400, `error.field="title"` |
| TC-API-004-08 | 설명 1000자 초과로 수정 | `description`이 1001자 | 400, `error.field="description"` |
| TC-API-004-09 | 잘못된 우선순위로 수정 | `priority="URGENT"` | 400, `error.field="priority"` |
| TC-API-004-10 | 과거 날짜로 종료예정일 수정 | `dueDate`=어제 | 400, `error.field="dueDate"` |
| TC-API-004-11 | 존재하지 않는 티켓 수정 시도 | `id=999999` | 404, `error.code="TICKET_NOT_FOUND"` |
| TC-API-004-12 | `status`/`position` 필드를 body에 포함해 전달 | `{ status: "DONE" }` | 이 API에서는 처리 대상이 아니므로 무시됨(또는 Zod 스키마에 없는 필드로 거부) — 실제 상태/순서는 변경되지 않음 |
| TC-API-004-13 | ID가 정수가 아님 | `id="abc"` | 400, `error.code="INVALID_ID"`, `error.message="유효하지 않은 티켓 ID입니다"` |
| TC-API-004-14 | ID가 음수 또는 0 | `id=-1` 또는 `id=0` | 400, `error.code="INVALID_ID"` |
| TC-API-004-15 | `dueDate`를 `null`로 명시적 초기화 | 기한이 지난 미완료 티켓에 `{ dueDate: null }` | 200, `dueDate=null`, `isOverdue=false`로 재연산됨 |
| TC-API-004-16 | 여러 필드 중 하나만 유효하지 않음 | `{ title: "정상", priority: "URGENT" }` | 400, `error.field="priority"`, `title`을 포함해 어떤 필드도 반영되지 않음 |
| TC-API-004-17 | 요청 본문이 JSON이 아니거나 객체가 아님 | body=`not json` 또는 `[]` | 400, `error.code="VALIDATION_ERROR"`, `error.field` 없음, `error.message="요청 본문이 올바른 JSON 형식이 아닙니다"` |
| TC-API-004-18 | 서비스 계층에서 예외 발생 | DB 오류 등 예상치 못한 예외 | 500, `error.code="INTERNAL_ERROR"`, `error.message="티켓을 수정하지 못했습니다"` |

---

### 2.5 `PATCH /api/tickets/:id/complete` — 티켓 완료 처리 (FR-005)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-005-01 | TODO 상태 티켓을 완료 처리 | `status="TODO"`인 티켓 | 200, `status="DONE"`, `completedAt`=현재 시각, `updatedAt`=현재 시각으로 갱신, `isOverdue=false` |
| TC-API-005-02 | IN_PROGRESS 상태 티켓을 완료 처리 | `status="IN_PROGRESS"`인 티켓 | 200, `status="DONE"`, `completedAt`=현재 시각 |
| TC-API-005-03 | DONE 칼럼에 기존 티켓이 없는 상태에서 완료 처리 | DONE 칼럼 티켓 0개 | 200, `position=1024` |
| TC-API-005-04 | DONE 칼럼에 기존 티켓이 있는 상태에서 완료 처리 | DONE 칼럼 최솟값 `position=1024`인 티켓 존재 | 200, 새 티켓 `position < 1024` (맨 위 배치) |
| TC-API-005-07 | 이미 DONE인 티켓을 다시 완료 처리 (멱등) | `status="DONE"`, `completedAt`·`position`·`updatedAt`이 설정된 티켓 | 200, `completedAt`·`position`·`updatedAt`이 요청 전과 동일 (변경 없음), `isOverdue=false` |
| TC-API-005-08 | BACKLOG 상태 티켓을 완료 처리 | `status="BACKLOG"`인 티켓 | 200, `status="DONE"`, `completedAt`=현재 시각, `startedAt`은 `null` 유지 |
| TC-API-005-09 | 완료 처리 후 다른 필드는 변하지 않음 | 제목·설명·우선순위·시작예정일·종료예정일·`startedAt`이 채워진 티켓 | 200, 제목·설명·우선순위·시작예정일·종료예정일·`startedAt`·`createdAt`이 요청 전과 동일 |
| TC-API-005-11 | 요청 본문이 있어도 동일하게 처리 | 본문 없는 요청과 깨진 JSON 문자열(`"not json"`) 본문 요청 | 두 경우 모두 200, 본문 없는 요청과 같은 결과 (본문은 무시됨) |
| TC-API-005-12 | 완료 직후 보드 조회에 반영 | 티켓 완료 처리 후 `GET /api/tickets` 호출 | 200, `DONE` 배열에 해당 티켓이 포함되고 맨 앞에 위치 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-005-05 | ID 형식 오류 | `id="abc"` | 400, `error.code="INVALID_ID"` |
| TC-API-005-06 | 존재하지 않는 티켓 완료 처리 시도 | `id=999999` | 404, `error.code="TICKET_NOT_FOUND"`, `error.message="존재하지 않거나 삭제된 티켓입니다"` |
| TC-API-005-10 | ID가 0 또는 음수 | `id="0"`, `id="-1"` | 400, `error.code="INVALID_ID"`, `error.message="유효하지 않은 티켓 ID입니다"` |
| TC-API-005-13 | 서비스 계층 예외 | 서비스가 DB 오류로 예외를 던짐 | 500, `error.code="INTERNAL_ERROR"`, `error.message="티켓을 완료 처리하지 못했습니다"` |

---

### 2.6 `DELETE /api/tickets/:id` — 티켓 삭제 (FR-006)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-006-01 | 존재하는 티켓 삭제 | 사전에 생성된 티켓의 `id` | 204, 본문 없음. 이후 동일 ID로 조회 시 404 |
| TC-API-006-02 | 삭제 후 DB에서 완전히 제거되는지 확인 | 삭제 직후 | DB에 해당 row가 남아있지 않음 (Hard Delete, soft-delete 플래그 없음) |
| TC-API-006-07 | 본문이 있어도 동일 결과 | 깨진 JSON 문자열 본문으로 요청 | 204, 본문 없는 요청과 같은 결과 |
| TC-API-006-08 | 삭제 후 다른 티켓 불변 | 같은 칼럼의 티켓 3개 중 하나 삭제 | 나머지 티켓의 내용과 `position`이 삭제 전과 동일 (재정렬 없음) |
| TC-API-006-09 | 삭제 직후 보드 조회에 반영 | 티켓 삭제 후 `GET /api/tickets` 호출 | 200, 어느 칼럼에도 삭제한 티켓이 없음 |
| TC-API-006-10 | 모든 상태의 티켓 삭제 | BACKLOG·TODO·IN_PROGRESS·DONE(24시간 지나 보드에서 숨겨진 DONE 포함) 티켓 | 모두 204로 삭제됨 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-006-03 | ID 형식 오류 | `id="abc"` | 400, `error.code="INVALID_ID"` |
| TC-API-006-04 | 존재하지 않는 티켓 삭제 시도 | `id=999999` | 404, `error.code="TICKET_NOT_FOUND"`, `error.message="존재하지 않거나 삭제된 티켓입니다"` |
| TC-API-006-05 | 이미 삭제된 티켓을 다시 삭제 시도 | 직전에 삭제한 `id` 재요청 | 404, `error.code="TICKET_NOT_FOUND"` |
| TC-API-006-06 | ID가 0 또는 음수 | `id="0"`, `id="-1"` | 400, `error.code="INVALID_ID"`, `error.message="유효하지 않은 티켓 ID입니다"` |
| TC-API-006-11 | 서비스 계층 예외 | 서비스가 DB 오류로 예외를 던짐 | 500, `error.code="INTERNAL_ERROR"`, `error.message="티켓을 삭제하지 못했습니다"` |

---

### 2.7 `PATCH /api/tickets/reorder` — 상태/순서 변경 (FR-007)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-007-01 | 같은 칼럼 내에서 두 카드 사이로 순서 변경 | `prev.position=1024`, `next.position=2048` 사이로 이동 | 200, 이동한 티켓 `position=1536` (`(1024+2048)/2`) |
| TC-API-007-02 | 칼럼 맨 앞으로 이동 | 대상 칼럼 첫 번째 카드 `position=1024` | 200, 이동한 티켓 `position = 1024 - 1024 = 0` |
| TC-API-007-03 | 칼럼 맨 뒤로 이동 | 대상 칼럼 마지막 카드 `position=2048` | 200, 이동한 티켓 `position = 2048 + 1024 = 3072` |
| TC-API-007-04 | 삽입 간격이 1 미만이 되는 경우 | `prev.position=1024`, `next.position=1024`(같은 값) 또는 `next.position=1025`(인접 정수, 클라이언트가 올림한 `position=1025`를 전송) | 200, 해당 칼럼 전체가 1024 간격으로 재정렬되고 이동한 티켓이 `next` 바로 앞(= `prev`와 `next` 사이)에 위치 |
| TC-API-007-05 | BACKLOG → TODO로 이동 (최초 시작) | 이동 대상 티켓의 `startedAt=null` | 200, `status="TODO"`, `startedAt`=현재 시각으로 설정 |
| TC-API-007-06 | BACKLOG → IN_PROGRESS로 직접 이동 (TODO 미경유) | 이동 대상 티켓의 `startedAt=null` | 200, `status="IN_PROGRESS"`, `startedAt`=현재 시각으로 설정 |
| TC-API-007-07 | 이미 `startedAt`이 설정된 티켓을 TODO ↔ IN_PROGRESS 간 이동 | `startedAt`=3일 전으로 이미 설정된 티켓 | 200, `startedAt` 값이 변경되지 않고 기존 값 유지 |
| TC-API-007-08 | TODO에서 BACKLOG로 되돌림 | `status="TODO"`, `startedAt`=설정된 값 | 200, `status="BACKLOG"`, `startedAt=null`로 초기화 |
| TC-API-007-25 | IN_PROGRESS·DONE에서 BACKLOG로 되돌림 | `status="IN_PROGRESS"` 또는 `"DONE"`, `startedAt`=설정된 값 | 200, `status="BACKLOG"`, `startedAt=null`로 초기화 (DONE이면 `completedAt=null`도) |
| TC-API-007-09 | DONE에서 다른 칼럼(BACKLOG/TODO/IN_PROGRESS)으로 되돌림 | `status="DONE"`, `completedAt`=설정된 값 | 200, `completedAt=null`로 초기화 |
| TC-API-007-10 | DONE이 아닌 칼럼 간 이동(BACKLOG↔TODO↔IN_PROGRESS) | `completedAt`이 이미 `null`인 티켓 | 200, `status`가 요청한 대상 칼럼 값으로 갱신됨, `completedAt`은 계속 `null` 유지 (변경 없음) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-007-11 | 대상 상태로 `DONE`을 요청 | `{ status: "DONE" }` | 400, `error.code="VALIDATION_ERROR"`, `error.message="상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요"` |
| TC-API-007-12 | 허용되지 않는 임의의 상태 문자열 | `{ status: "ARCHIVED" }` | 400, `error.code="VALIDATION_ERROR"` |
| TC-API-007-13 | 존재하지 않는 `ticketId` | `ticketId=999999` | 404, `error.code="TICKET_NOT_FOUND"`, `error.message="존재하지 않거나 삭제된 티켓입니다"` |
| TC-API-007-14 | 트랜잭션 도중 일부만 반영되고 나머지가 실패하는 상황 방지 (원자성) | 충돌 재정렬 경로(여러 UPDATE)에서 이동 티켓 UPDATE는 성공하고 이어지는 다른 티켓의 `position` UPDATE(`tx.update` 두 번째 호출)에서 DB 오류 주입. 정상 경로는 `status`·`position`을 하나의 UPDATE로 쓰므로 부분 반영 상태가 구조적으로 생기지 않는다 | 예외가 호출자에게 전파되고(라우트에서는 500), 이동 티켓을 포함한 모든 티켓의 `status`/`position`/`startedAt`/`completedAt`/`updatedAt`이 요청 전 값 그대로 (전체 롤백) |
| TC-API-007-15 | `ticketId` 형식 오류 | `ticketId`가 `0`, `-1`, `"abc"`, 누락 | 400, `error.code="VALIDATION_ERROR"`, `error.field="ticketId"`, `error.message="유효하지 않은 티켓 ID입니다"` |
| TC-API-007-16 | `position` 형식 오류 | `position`이 누락, `"abc"`, `1.5`, 32비트 범위 초과 | 400, `error.code="VALIDATION_ERROR"`, `error.field="position"`, `error.message="위치는 -2147483648 이상 2147483647 이하의 정수로 입력해주세요"` |
| TC-API-007-17 | 요청 본문이 JSON이 아니거나 객체가 아님 | body=`not json` 또는 `[]` | 400, `error.code="VALIDATION_ERROR"`, `error.field` 없음, `error.message="요청 본문이 올바른 JSON 형식이 아닙니다"` |
| TC-API-007-18 | `status` 누락 | `{ ticketId: 1, position: 1024 }` | 400, `error.code="VALIDATION_ERROR"`, `error.field` 없음, `error.message="상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요"` |
| TC-API-007-19 | 같은 칼럼의 같은 위치로 이동 | 이미 `position=1024`인 티켓을 같은 칼럼·같은 `position`으로 요청 | 200, 보드 배치가 요청 전과 동일 |
| TC-API-007-20 | 빈 칼럼으로 이동 | 대상 칼럼에 티켓 0개, `position=1024` | 200, 해당 티켓이 칼럼의 유일한 항목, `position=1024` |
| TC-API-007-21 | 이동 후 다른 필드 불변 | 제목·설명·우선순위·예정일·종료예정일이 채워진 티켓 이동, 본문에 `title` 등 다른 키 포함 | 200, 제목·설명·우선순위·예정일·종료예정일·`createdAt`이 요청 전과 동일 |
| TC-API-007-22 | 서비스 계층 예외 | 서비스가 DB 오류로 예외를 던짐 | 500, `error.code="INTERNAL_ERROR"`, `error.message="티켓 순서를 변경하지 못했습니다"` |
| TC-API-007-23 | 응답이 보드 목록 조회와 같은 형식 | 이동 성공 응답 | 200, `{ BACKLOG, TODO, IN_PROGRESS, DONE }` 4개 키, 24시간이 지난 DONE 티켓 제외 |
| TC-API-007-24 | 24시간이 지나 보드에서 숨겨진 DONE 티켓 이동 | `status="DONE"`, `completedAt`=25시간 전인 티켓을 `TODO`로 이동 | 200, 이동한 티켓의 `completedAt=null` |
| TC-API-007-26 | 충돌 재정렬이 다른 칼럼에 영향 없음 | 대상 칼럼에서 `position` 충돌 발생 | 대상 칼럼만 1024 간격으로 재정렬, 다른 칼럼 티켓의 `position`은 변경 없음 |

---

### 2.8 FR-008 오버듀(Overdue) 판정 — 엔드포인트 통합 검증

> 판정식(REQUIREMENTS.md FR-008 / DATA_MODEL.md §5.3): `isOverdue = (status !== 'DONE') && (dueDate !== null) && (dueDate < now)`.
> `isOverdue`는 자체 API가 없는 파생 필드라, 이 값을 반환하는 모든 엔드포인트에 흩어져 있던 케이스를 한곳에 모아 판정식 자체의 커버리지를 한눈에 볼 수 있게 한다. 각 케이스가 검증하는 실제 엔드포인트는 "대상 API" 열에 표기한다.

| 번호 | 대상 API | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|------|
| TC-API-008-01 | `POST /api/tickets` | 종료예정일을 오늘 이후로 생성 | `dueDate` = 내일 날짜 | 201, `isOverdue=false` |
| TC-API-008-02 | `GET /api/tickets` | BACKLOG 상태에서 종료예정일이 지난 티켓 조회 | `status="BACKLOG"`, `dueDate`=어제 | 200, 해당 티켓의 `isOverdue=true` |
| TC-API-008-03 | `GET /api/tickets` | TODO 상태에서 종료예정일이 지난 티켓 조회 | `status="TODO"`, `dueDate`=어제 | 200, 해당 티켓의 `isOverdue=true` |
| TC-API-008-04 | `GET /api/tickets` | IN_PROGRESS 상태에서 종료예정일이 지난 티켓 조회 | `status="IN_PROGRESS"`, `dueDate`=어제 | 200, 해당 티켓의 `isOverdue=true` |
| TC-API-008-05 | `GET /api/tickets` | DONE 상태에서 종료예정일이 지난 티켓 조회 | `status="DONE"`, `dueDate`=어제 | 200, 해당 티켓의 `isOverdue=false` (DONE 우선 적용) |
| TC-API-008-06 | `GET /api/tickets/:id` | 종료예정일이 지난 미완료 티켓 단건 조회 | `status="IN_PROGRESS"`, `dueDate`=어제 | 200, `isOverdue=true` |
| TC-API-008-07 | `PATCH /api/tickets/:id` | `dueDate`를 `null`로 초기화 | 기존 `dueDate`가 있던(과거든 미래든) 티켓에 `{ dueDate: null }` | 200, `dueDate=null`이므로 `isOverdue=false` (dueDate 부재 우선 적용) |
| TC-API-008-08 | `PATCH /api/tickets/:id` | `dueDate`를 미래 날짜로 수정 | 기존에 지연 상태였던 티켓에 `{ dueDate: 내일 }` | 200, `isOverdue`가 재연산되어 `false`로 전환 |
| TC-API-008-09 | `PATCH /api/tickets/:id/complete` | 종료예정일이 지난 티켓을 완료 처리 | `dueDate`=어제인 티켓 | 200, `status="DONE"`이 되므로 `isOverdue=false`로 연산됨 (DONE 우선 적용) |

**BACKLOG도 다른 칼럼과 동일하게 판정 대상**: TC-API-008-02는 DATA_MODEL.md §5.3에서 강조하는 "BACKLOG도 다른 칼럼과 동일한 `Column`이므로 오버듀 판정이 동일하게 적용된다"는 규칙을 별도로 검증한다 — BACKLOG를 예외로 착각해 판정 로직에서 빠뜨리는 구현 실수를 잡기 위한 케이스다.

**판정식 우선순위 교차 확인**: TC-API-008-05/TC-API-008-09는 "`status===DONE`이면 `dueDate`가 과거여도 무조건 `false`"를, TC-API-008-07은 "`dueDate===null`이면 상태와 무관하게 무조건 `false`"를 확인한다 — 판정식의 두 `false` 조건(`status`, `dueDate`)이 `dueDate < now` 비교보다 먼저 평가되는지를 서로 다른 엔드포인트에서 교차 검증하는 것이 이 섹션의 목적이다.

---

### 2.9 공통 응답 형식 / 상태 코드 (0. 공통 규칙)

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-API-COMMON-01 | 모든 성공 응답이 wrapper 없이 리소스를 그대로 반환하는지 | 임의의 성공 응답 | 응답 최상위에 `data` 등 별도 wrapper 키 없이 리소스 필드가 바로 위치 |
| TC-API-COMMON-02 | 첫 번째 검증 실패가 특정 필드에 대한 400 에러에 `field`가 포함되는지 | 단일 필드 검증 실패 케이스 | `error.field`에 해당 필드명 포함 |
| TC-API-COMMON-03 | 필드로 특정할 수 없거나 명세가 생략을 정한 400 에러에는 `field`가 생략되는지 | 요청 본문 전체가 잘못된 경우(`not json`, `[]`) 또는 reorder의 `status` 오류 | `error.field` 키 자체가 응답에 없음 |
| TC-API-COMMON-04 | 여러 필드가 동시에 실패하면 첫 번째 실패 하나만 반환하는지 | `POST /api/tickets`에 `title` 누락 + `priority` 잘못된 값, `PATCH /api/tickets/reorder`에 `ticketId=0` + 잘못된 `status` | 400, 오류는 하나만 반환되고 스키마 정의 순서상 첫 실패 필드가 `error.field`(각각 `title`, `ticketId`) |

---

## 3. 컴포넌트 테스트 케이스 (프론트엔드)

> COMPONENT_SPEC.md의 컴포넌트 단위로 표를 나눈다. "조건"에는 테스트를 성립시키는 데 필요한 props/데이터 값을 명시하고, "기대 결과"는 화면에 보이는 것과 사용자가 할 수 있는 조작만으로 서술한다 — 내부 상태 변수명이나 함수 호출 여부가 아니라 "무엇이 보이는가/무엇을 할 수 있는가"로 적는다.
> 각 표는 "정상 케이스"와 "예외 케이스"로 구분한다.

### 3.1 TicketCard (§5.1)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-001-01 | 기본 정보 렌더링 | `title="로그인 페이지 구현"`, `priority="HIGH"` | 카드에 제목 "로그인 페이지 구현"과 HIGH 우선순위 뱃지가 보인다 |
| TC-COMP-001-02 | 종료예정일이 있는 카드 | `dueDate="2026-10-01"` | 카드에 종료예정일 텍스트가 보인다 |
| TC-COMP-001-03 | 종료예정일이 없는 카드 | `dueDate=null` | 카드에 종료예정일 관련 텍스트가 보이지 않는다 |
| TC-COMP-001-04 | 지연된 카드 | `isOverdue=true` | 카드 테두리가 강조되고, 경고 아이콘과 함께 "지연" 뱃지가 보인다 |
| TC-COMP-001-05 | 정상 기한 카드 | `isOverdue=false` | 카드에 "지연" 뱃지나 강조 테두리가 보이지 않는다 |
| TC-COMP-001-06 | 우선순위별 뱃지 색상 | `priority="LOW"` / `"MEDIUM"` / `"HIGH"` 각각 | 뱃지 색상이 회색(LOW) / 파란색(MEDIUM) / 빨간색(HIGH)으로 서로 다르게 보인다 |
| TC-COMP-001-07 | 200자에 가까운 긴 제목 | `title`이 200자 | 카드 폭을 넘는 부분이 말줄임(…) 처리되어 한 줄/지정된 줄 수 안에 보인다 |
| TC-COMP-001-08 | 카드 클릭 | 카드 영역(제목 텍스트 포함) 클릭 | 해당 티켓의 상세 모달이 열린다 |
| TC-COMP-001-09 | 키보드로 카드 열기 | 카드에 Tab으로 포커스 후 Enter | 마우스 클릭과 동일하게 상세 모달이 열린다 |
| TC-COMP-001-10 | 완료된 카드의 기본 정보 표시 | `status="DONE"`, `priority="HIGH"` | DONE 상태에서도 제목과 우선순위 뱃지가 다른 상태의 카드와 동일하게 보인다 |
| TC-COMP-001-11 | 완료된 카드는 종료예정일이 지났어도 지연 표시가 없음 | `status="DONE"`, `dueDate`=어제, `isOverdue=false` | 종료예정일이 과거임에도 카드에 "지연" 뱃지나 강조 테두리가 보이지 않는다 |
| TC-COMP-001-13 | 설명이 있는 카드 | `description="로그인 화면과 검증 로직을 구현한다"` | 제목 아래에 설명 텍스트가 보인다 |
| TC-COMP-001-14 | 설명이 긴 카드 | `description`이 1000자 | 설명이 최대 2줄까지만 보이고 나머지는 말줄임(…) 처리된다 (줄 수 제한은 수동 확인) |
| TC-COMP-001-15 | Space는 카드를 열지 않음 | 카드에 Tab으로 포커스 후 Space (드래그 센서가 없는 단독 렌더링) | 상세 모달이 열리지 않는다 (Space는 드래그 픽업 전용) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-001-12 | 설명이 없는 카드 | `description=null` | 카드에 설명 텍스트 영역 없이 제목/뱃지만 보인다 (레이아웃이 깨지지 않음) |

---

### 3.2 Column / ColumnHeader (§4.1, §4.2)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-002-01 | 카드가 있는 칼럼 | `tickets` 배열에 3개 | 칼럼 헤더에 숫자 "3"이 보이고, 그 아래 카드 3개가 순서대로 보인다 |
| TC-COMP-002-02 | 칼럼 내 카드 정렬 | `position` 오름차순으로 정렬된 `tickets` 배열 전달 | 화면에서도 위에서 아래로 동일한 순서로 카드가 보인다 |
| TC-COMP-002-03 | 칼럼 헤더 라벨 | `status="IN_PROGRESS"` | 칼럼 헤더에 "In Progress" 라벨이 보인다 |
| TC-COMP-002-04 | DONE 칼럼 안내 문구 | `status="DONE"` | 카드 목록 하단에 "24시간 지난 완료 항목은 표시되지 않아요" 문구가 보인다 |
| TC-COMP-002-05 | DONE이 아닌 칼럼에는 안내 문구 없음 | `status="TODO"` | 24시간 안내 문구가 보이지 않는다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-002-06 | 빈 칼럼 | `tickets` 배열이 빈 배열(`[]`) | 카드 대신 "아직 카드가 없어요" 같은 빈 상태 안내 문구가 보인다 |

---

### 3.3 Board (§3.4, dnd-kit + 반응형 레이아웃 §2 포함)

> COMPONENT_SPEC.md §2 "레이아웃 구성"의 실제 배치 구현 책임은 `Board`(§3.4)에 있으므로, 브레이크포인트별 배치 검증도 이 컴포넌트의 테스트로 함께 다룬다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-003-01 | 4칼럼 렌더링 순서 | `board` 데이터 전달 | 화면에 BACKLOG → TODO → IN_PROGRESS → DONE 순서로 4개 칼럼이 보인다 |
| TC-COMP-003-02 | 카드를 다른 칼럼으로 드래그하여 드롭 | BACKLOG의 카드를 TODO 칼럼 위로 드래그 후 드롭 | 드롭 즉시 카드가 TODO 칼럼으로 옮겨져 보인다 (응답을 기다리는 동안 화면이 멈추지 않음) |
| TC-COMP-003-03 | 같은 칼럼 내에서 순서 변경 | 같은 칼럼 안의 두 카드 위치를 바꿔 드롭 | 드롭한 위치에 맞게 카드 순서가 즉시 바뀌어 보인다 |
| TC-COMP-003-04 | 카드를 DONE 칼럼으로 드롭 | 임의 칼럼의 카드를 DONE 칼럼 위로 드래그 후 드롭 | 카드가 DONE 칼럼 맨 위로 옮겨져 보인다 |
| TC-COMP-003-05 | 드래그 시작 시 미리보기 | 카드를 누른 채 이동 시작 | 마우스를 따라다니는 카드 미리보기가 보이고, 원래 위치에는 자리 표시가 남는다 |
| TC-COMP-003-06 | 드래그 중 대상 칼럼 강조 | 카드를 특정 칼럼 위로 이동 | 마우스가 올라간 칼럼 영역이 다른 칼럼과 다르게 강조되어 보인다 |
| TC-COMP-003-07 | 키보드로 카드 이동 | 카드에 Tab으로 포커스 → Space로 픽업 → 화살표 키로 이동 → Space로 드롭 | 마우스 드래그와 동일하게 카드가 대상 칼럼으로 옮겨져 보인다 |
| TC-COMP-003-08 | 데스크톱 너비 배치 | 뷰포트 1024px 이상 | 좌측 BACKLOG 사이드바 + 우측 3칼럼(TODO/IN_PROGRESS/DONE)이 가로로 나란히 보인다 |
| TC-COMP-003-09 | 태블릿 너비 배치 | 뷰포트 768px | 2칼럼 그리드(1행: BACKLOG/TODO, 2행: IN_PROGRESS/DONE)로 보인다 |
| TC-COMP-003-10 | 모바일 너비 배치 | 뷰포트 360px | 4개 칼럼이 BACKLOG→TODO→IN_PROGRESS→DONE 순서로 세로로 나열되어 보인다 |
| TC-COMP-003-11 | 모바일 너비에서 터치 드래그 | 뷰포트 360px, 터치로 카드 드래그 | 데스크톱과 동일하게 카드가 대상 칼럼으로 옮겨져 보인다 |
| TC-COMP-003-16 | 빈 칼럼으로 드롭 | 카드가 하나도 없는 칼럼 위로 카드를 드래그 후 드롭 | 카드가 그 칼럼의 유일한 항목으로 옮겨져 보인다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-003-12 | 드롭 후 API 요청 실패 | 이동 요청 실패 상황 | 카드가 원래 위치로 조용히 되돌아가며, 별도의 에러 알림은 보이지 않는다 |
| TC-COMP-003-13 | 드래그 중 Esc로 취소 | 카드를 픽업한 상태에서 Esc 입력 | 카드가 원래 위치 그대로 남고 이동이 일어나지 않는다 |
| TC-COMP-003-14 | 보드 영역 바깥에 드롭 | 카드를 보드 바깥으로 드래그 후 놓기 | 카드가 원래 위치로 되돌아가며 화면에 변화가 없다 |
| TC-COMP-003-15 | DONE 칼럼 안에서 순서 변경 시도 | DONE 칼럼의 카드를 같은 칼럼의 다른 위치로 드래그 후 드롭 | 카드가 원래 위치로 돌아가고 이동 요청은 보내지지 않는다 (DONE 칼럼의 내부 순서는 바꿀 수 없음) |

---

### 3.4 BoardContainer — 로딩/에러 상태 (§3.2)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-004-01 | 데이터 로딩 완료 | 보드 데이터 정상 수신 | 스켈레톤이 사라지고 4개 칼럼과 카드들이 보인다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-004-02 | 데이터 로딩 중 | 보드 데이터 응답 대기 상태 | 카드 대신 4개 칼럼 형태의 스켈레톤이 보인다 |
| TC-COMP-004-03 | 초기 로드 실패 | 보드 조회 요청 실패 상황 | 칼럼/카드 대신 에러 메시지와 "재시도" 버튼이 화면에 보인다 |
| TC-COMP-004-04 | 재시도 버튼 클릭 | 에러 화면에서 "재시도" 클릭 | 잠시 후 정상적으로 보드 화면(4개 칼럼)으로 전환된다 |

---

### 3.5 BoardHeader / NewTicketButton (§3.3)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-005-01 | 헤더 기본 렌더링 | 보드 화면 진입 | 화면 상단에 "새 업무" 버튼이 보인다 |
| TC-COMP-005-02 | "새 업무" 버튼 클릭 | 버튼 클릭 | 제목/설명/우선순위/시작예정일/종료예정일 입력창이 있는 생성 모달이 화면에 나타난다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-005-03 | 검색창(SearchInput)에 입력 시도 | 검색창 클릭 후 타이핑 | 입력창이 비활성 상태라 아무 글자도 입력되지 않는다 (MVP, 2차 구현 예정) |

---

### 3.6 TicketFormModal — 생성 폼 (§6.1)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-006-01 | 모달 오픈 시 초기 상태 | `isOpen=true` | 빈 입력 필드들과, 우선순위는 "MEDIUM"이 기본 선택된 채로 모달이 보인다 |
| TC-COMP-006-02 | 모달 오픈 시 자동 포커스 | 모달이 열린 직후 | 별도 클릭 없이 바로 제목 입력창에 커서가 있어 바로 타이핑할 수 있다 |
| TC-COMP-006-03 | 제목만 입력하고 제출 | 제목에 "새 업무" 입력 후 "생성" 클릭 | 모달이 닫히고, BACKLOG 칼럼 맨 위에 "새 업무" 카드가 보인다 |
| TC-COMP-006-04 | 모든 필드를 채워 제출 | 제목/설명/우선순위(HIGH)/시작예정일/종료예정일 모두 입력 후 제출 | 모달이 닫히고, 생성된 카드에 HIGH 우선순위 뱃지가 함께 보인다 |
| TC-COMP-006-05 | 취소/바깥 클릭으로 닫기 | 입력 도중 취소 버튼 또는 오버레이 바깥 클릭 | 모달이 닫히고 카드는 생성되지 않는다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-006-06 | 제목을 비운 채 제출 | 제목 미입력 후 "생성" 클릭 | 모달이 닫히지 않고, 제목 입력창 아래에 "제목을 입력해주세요" 메시지가 보인다 |
| TC-COMP-006-07 | 과거 날짜로 종료예정일 선택 | 날짜 선택기에서 오늘 이전 날짜 선택 후 제출 | "종료예정일은 오늘 이후 날짜를 선택해주세요" 메시지가 해당 입력창 아래에 보인다 |
| TC-COMP-006-08 | 서버가 필드를 특정할 수 없는 400 에러를 반환 | 제출 요청이 필드 정보 없는 400으로 응답 | 모달은 유지되고, 폼 상단(또는 토스트)에 에러 메시지가 보인다 (특정 입력창 아래가 아님) |
| TC-COMP-006-09 | 제출 중 로딩 상태 | 제출 요청이 진행 중인 동안 | "생성" 버튼이 스피너와 함께 비활성화되어 중복 클릭으로 카드가 두 번 생성되지 않는다 |

---

### 3.7 TicketModal / TicketDetailView / TicketForm — 상세 조회 및 수정 (§6.2)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-007-01 | 카드 클릭 직후 상세 데이터 조회 중 | 카드 클릭 직후, `GET /api/tickets/:id` 응답 대기 상태 | 모달은 즉시 열리고, 상세/수정 영역 자리에 스켈레톤(로딩 표시)이 보인다 |
| TC-COMP-007-02 | 조회 완료 후 실제 내용으로 전환 | 스켈레톤 표시 중 응답 수신 | 스켈레톤이 사라지고 제목/설명/상태/시작일/종료일/생성일이 담긴 실제 내용으로 바뀐다 |
| TC-COMP-007-03 | 모달 오픈 시 상세 정보 표시 | `ticketId`로 조회된 티켓 데이터 | 제목, 설명, 상태, 시작일, 종료일, 생성일이 담긴 모달이 열린다 |
| TC-COMP-007-04 | 읽기 전용 필드는 수정 불가 | 모달 오픈 상태 | 상태/시작일/종료일/생성일은 입력창이 아닌 일반 텍스트로 보이며 클릭해도 수정할 수 없다 |
| TC-COMP-007-05 | 수정 가능 필드는 초기값이 채워짐 (수정 모드) | 기존 값이 있는 티켓으로 모달 오픈 | 제목/설명/우선순위/시작예정일/종료예정일 입력창에 기존 값이 그대로 보인다 |
| TC-COMP-007-06 | 제목을 수정하고 저장 | 제목 입력창 내용을 변경 후 "저장" 클릭 | 모달이 닫히고, 보드의 해당 카드 제목이 즉시 바뀌어 보인다 |
| TC-COMP-007-07 | 여러 필드를 동시에 수정하고 저장 | 설명/우선순위/종료예정일 동시 변경 후 저장 | 모달이 닫히고, 변경된 내용이 카드와 모달 재오픈 시 모두 반영되어 보인다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-007-08 | 제목을 비운 채 저장 시도 | 제목 입력창을 모두 지우고 "저장" 클릭 | 모달이 닫히지 않고, 제목 입력창 아래에 "제목을 입력해주세요" 메시지가 보인다 |
| TC-COMP-007-09 | 과거 날짜로 종료예정일 수정 시도 | 과거 날짜 선택 후 저장 | "종료예정일은 오늘 이후 날짜를 선택해주세요" 메시지가 해당 입력창 아래에 보인다 |
| TC-COMP-007-10 | 저장 중 API 실패 | 수정 요청이 실패 응답을 받는 상황 | 모달은 유지되고, 에러 토스트가 화면에 보인다 |
| TC-COMP-007-11 | ESC 키로 모달 닫기 | 모달이 열린 상태에서 Esc 입력 | 저장하지 않고 모달이 닫히며, 카드 내용은 변경되지 않는다 |
| TC-COMP-007-12 | 상세 데이터 조회 자체가 실패 | `GET /api/tickets/:id`가 404 또는 500으로 응답 | 스켈레톤이 사라지고 에러 메시지가 모달 내부에 보인다. 수정 폼이나 삭제 버튼은 보이지 않는다 |

---

### 3.8 DeleteButton / ConfirmDialog (§6.3)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-008-01 | 삭제 버튼 노출 | 상세 모달 오픈 상태 | 모달 하단에 "삭제" 버튼이 보인다 |
| TC-COMP-008-02 | 삭제 버튼 클릭 | "삭제" 클릭 | "정말 삭제하시겠습니까?" 확인 다이얼로그가 보인다 |
| TC-COMP-008-03 | 확인 다이얼로그 기본 포커스 | 다이얼로그가 열린 직후 | "취소" 버튼에 기본 포커스가 있어, 실수로 Enter를 눌러도 삭제되지 않는다 |
| TC-COMP-008-04 | 삭제 확인 | "확인" 클릭 | 두 모달이 모두 닫히고, 보드에서 해당 카드가 사라진다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-008-05 | 삭제 취소 | "취소" 클릭 | 확인 다이얼로그만 닫히고, 상세 모달과 카드는 그대로 남아있다 |
| TC-COMP-008-06 | 삭제 요청 실패 | 삭제 요청이 실패 응답을 받는 상황 | 두 모달이 닫히지 않고 유지되며, 에러 토스트가 보인다. 카드는 사라지지 않는다 |

---

### 3.9 공통 UI Primitive — Modal / Badge / Button (§8.5, §8.6, §8.8)

> `TicketFormModal`/`TicketModal`이 `Modal`을, `PriorityBadge`/`OverdueIndicator`가 `Badge`를, 거의 모든 버튼형 UI가 `Button`을 감싸서 쓰는 공통 기반 컴포넌트다. 상위 컴포넌트 테스트에서 간접적으로 검증되긴 하지만, 여러 곳에서 재사용되는 만큼 이 표에서 한 번 독립적으로 검증해두면 상위 컴포넌트마다 같은 동작을 중복 검증할 필요가 줄어든다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-009-01 | Modal 오픈 시 배경 스크롤 잠금 | `isOpen=true` | 모달이 열려 있는 동안 배경 콘텐츠가 스크롤되지 않는다 |
| TC-COMP-009-02 | Modal 오버레이 바깥 클릭으로 닫기 | 모달 바깥(반투명 배경) 클릭 | 모달이 닫힌다 |
| TC-COMP-009-03 | Badge 색상 variant | `variant="low"` / `"medium"` / `"high"` / `"overdue"` 각각 | 각 variant마다 서로 다른 배경/텍스트 색상으로 보인다 |
| TC-COMP-009-04 | Button variant별 스타일 | `variant="primary"` / `"secondary"` / `"danger"` / `"ghost"` 각각 | 4가지 버튼이 서로 다른 색상/스타일로 구분되어 보인다 |
| TC-COMP-009-05 | Button 로딩 상태 | `isLoading=true` | 버튼 안에 스피너가 보이고 클릭해도 반응하지 않는다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-009-06 | Modal이 닫힌 상태 | `isOpen=false` | 모달과 오버레이가 화면에 전혀 보이지 않는다 |
| TC-COMP-009-07 | Button에 onClick이 없는 상태에서 클릭 | `onClick` prop 미전달, 버튼 클릭 | 에러 없이 아무 동작도 일어나지 않는다 |

---

### 3.10 ConfirmDialog — 공통 primitive 단독 (§8.7)

> TC-COMP-008은 `TicketModal` 안에서의 삭제 흐름을, 이 표는 `ConfirmDialog` 컴포넌트 자체의 동작을 검증한다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-010-01 | 열린 상태 렌더링 | `isOpen=true`, `title="정말 삭제하시겠습니까?"` | 확인 문구와 "확인"·"취소" 버튼이 있는 알림 대화상자(`alertdialog`)가 보인다 |
| TC-COMP-010-02 | 기본 포커스 | 대화상자가 열린 직후 | "취소" 버튼에 포커스가 있고 "확인" 버튼에는 없다 |
| TC-COMP-010-03 | 확인 클릭 | "확인" 클릭 | `onConfirm`이 한 번 호출되고 `onCancel`은 호출되지 않는다 |
| TC-COMP-010-04 | 취소 클릭 | "취소" 클릭 | `onCancel`이 한 번 호출되고 `onConfirm`은 호출되지 않는다 |
| TC-COMP-010-05 | Esc로 취소 | 열린 상태에서 Esc 입력 | `onCancel`이 호출되고 `onConfirm`은 호출되지 않는다 |
| TC-COMP-010-06 | 위험 동작 스타일 | `danger=true` / `danger` 생략 | `true`면 "확인" 버튼이 위험(danger) 스타일, 생략하면 기본(primary) 스타일로 보인다 (실제 색상은 수동 확인) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-010-07 | 닫힌 상태 | `isOpen=false` | 대화상자가 화면에 전혀 보이지 않는다 |
| TC-COMP-010-08 | 확인 처리 중 중복 클릭 | `onConfirm`이 아직 끝나지 않은 Promise를 반환하는 동안 "확인"을 연속 두 번 클릭 | "확인" 버튼이 스피너와 함께 비활성화되고 `onConfirm`은 한 번만 호출된다 |
| TC-COMP-010-09 | 확인 처리 실패 | `onConfirm`이 reject | "확인" 버튼의 로딩이 풀려 다시 누를 수 있고, 처리되지 않은 예외로 번지지 않는다 (오류 표시는 호출부 책임) |

---

### 3.11 상태·오류 표시 — EmptyColumnState / BoardSkeleton / ErrorBanner (§8.1, §8.2, §8.4)

> 표시 전용 컴포넌트라 예외 케이스는 따로 두지 않는다. 이 컴포넌트들이 `Column`, `BoardContainer` 안에서 쓰이는 흐름은 TC-COMP-002-06, TC-COMP-004-02~04가 검증한다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-011-01 | 빈 칼럼 안내 | `EmptyColumnState`, `label="아직 카드가 없어요"` | 안내 문구가 그대로 보인다 |
| TC-COMP-011-02 | 보드 스켈레톤 | `BoardSkeleton` 렌더링 | 4개 칼럼 모양의 자리 표시가 보이고, 보조기기에는 "로딩 중" 상태로 전달된다 (`role="status"`, `aria-busy`). 카드 제목 같은 실제 데이터 텍스트는 없다 |
| TC-COMP-011-03 | 에러 배너 표시 | `ErrorBanner`, `message="티켓 목록을 불러오지 못했습니다"` | 메시지와 "재시도" 버튼이 보이고, 경고(`role="alert"`)로 전달된다 |
| TC-COMP-011-04 | 재시도 클릭 | "재시도" 클릭 | `onRetry`가 한 번 호출된다 |

---

### 3.12 ErrorToast (§8.3)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-012-01 | 토스트 표시 | `message="티켓을 저장하지 못했습니다"` | 메시지가 화면에 보이고 경고(`role="alert"`)로 전달된다 |
| TC-COMP-012-02 | 5초 뒤 자동으로 사라짐 | 표시 후 4.9초 시점과 5초 경과 시점 | 4.9초에는 보이고, 5초가 지나면 사라지며 `onDismiss`가 한 번 호출된다 |
| TC-COMP-012-03 | 표시 중 메시지 교체 | 표시 중 `message`가 다른 값으로 바뀜 | 새 메시지가 보이고, 타이머가 다시 시작되어 새 메시지 기준 5초 뒤에 사라진다 (처음 메시지 기준 5초에는 사라지지 않음) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-012-04 | 사라지기 전에 화면에서 제거됨 | 5초가 지나기 전에 토스트가 언마운트됨 | 이후에도 `onDismiss`가 호출되지 않고 오류·경고가 발생하지 않는다 |

---

### 3.13 PriorityBadge / OverdueIndicator (§5.2, §5.3)

> 카드 안에서의 표시는 TC-COMP-001-01, 04~06이, 이 표는 두 컴포넌트 단독 동작을 검증한다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-COMP-013-01 | 우선순위 텍스트 | `PriorityBadge`, `priority="LOW"` / `"MEDIUM"` / `"HIGH"` 각각 | "LOW" / "MEDIUM" / "HIGH" 텍스트가 각각 보인다 (색상에만 의존하지 않음) |
| TC-COMP-013-02 | 우선순위별 색상 구분 | 위 세 값 | 세 배지의 색상 스타일(variant)이 서로 다르다 (실제 색상은 수동 확인) |
| TC-COMP-013-03 | 지연 표시 | `OverdueIndicator` 렌더링 | "지연" 텍스트와 경고 아이콘이 함께 보이고 `aria-label="지연됨"`이 있다 |
| TC-COMP-013-04 | 아이콘은 장식 | `OverdueIndicator` 렌더링 | 아이콘은 보조기기에서 숨겨지고(`aria-hidden`) "지연" 텍스트만 읽힌다 |

---

### 3.14 ticketApi — 클라이언트 API 호출 함수 (TRD §3, API_SPEC)

> 파일 `src/client/api/ticketApi.ts`, 테스트 `__tests__/api/ticketApi.test.ts`(jsdom, `fetch`를 mock). 컴포넌트와 훅은 서버와 이 함수로만 통신한다 (TRD §4). 화면 아래 계층이라 기대 결과를 **요청 형식과 반환값**으로 적는다.
> 오류는 `ApiError`(`status`, `code`, `message`, `field?`)로 통일해 reject한다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-CLIENT-API-001-01 | 보드 조회 | `fetchBoard()`, 서버가 200과 4개 칼럼 응답 | `GET /api/tickets`로 요청하고 `{ BACKLOG, TODO, IN_PROGRESS, DONE }` 형태를 반환한다 |
| TC-CLIENT-API-001-02 | 단건 조회 | `fetchTicket(7)` | `GET /api/tickets/7`로 요청하고 티켓 한 건을 반환한다 |
| TC-CLIENT-API-001-03 | 생성 | `createTicket({ title: "새 업무" })`, 서버가 201 | `POST /api/tickets`, `Content-Type: application/json`, 본문 `{"title":"새 업무"}`로 요청하고 생성된 티켓을 반환한다 |
| TC-CLIENT-API-001-04 | 수정 | `updateTicket(7, { title: "수정" })` | `PATCH /api/tickets/7`로 전달한 필드만 담아 요청하고 수정된 티켓을 반환한다 |
| TC-CLIENT-API-001-05 | 삭제 | `deleteTicket(7)`, 서버가 204(본문 없음) | `DELETE /api/tickets/7`로 요청하고, 본문이 없어도 오류 없이 완료된다 |
| TC-CLIENT-API-001-06 | 완료 처리 | `completeTicket(7)` | `PATCH /api/tickets/7/complete`로 본문 없이 요청하고 갱신된 티켓을 반환한다 |
| TC-CLIENT-API-001-07 | 순서·상태 변경 | `reorderTicket({ ticketId: 7, status: "TODO", position: 1536 })` | `PATCH /api/tickets/reorder`, 본문 `{"ticketId":7,"status":"TODO","position":1536}`로 요청하고 4개 칼럼 보드를 반환한다 |
| TC-CLIENT-API-001-08 | 날짜 필드 변환 | 응답에 `startedAt`/`completedAt`/`createdAt`/`updatedAt`이 ISO 문자열(또는 `null`)로 포함 | 이 네 필드는 `Date` 객체(`null`은 `null`)로, `plannedStartDate`/`dueDate`는 `"YYYY-MM-DD"` 문자열 그대로 반환한다 (보드·단건·생성·수정·완료·reorder 응답 모두 동일, DATA_MODEL.md §4) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-CLIENT-API-001-09 | 필드가 있는 400 | 서버가 400과 `{ error: { code: "VALIDATION_ERROR", field: "title", message: "제목을 입력해주세요" } }` 응답 | `ApiError`로 reject되고 `status=400`, `code`, `field`, `message`가 그대로 담긴다 |
| TC-CLIENT-API-001-10 | 필드가 없는 400 | `field`가 없는 400 응답 | `ApiError`의 `field`가 `undefined`다 |
| TC-CLIENT-API-001-11 | 404 | `TICKET_NOT_FOUND` 응답 | `ApiError`(`status=404`, `code="TICKET_NOT_FOUND"`)로 reject된다 |
| TC-CLIENT-API-001-12 | 500 | `INTERNAL_ERROR` 응답 | `ApiError`(`status=500`, `code="INTERNAL_ERROR"`)로 reject되고 서버 메시지가 보존된다 |
| TC-CLIENT-API-001-13 | JSON이 아닌 오류 응답 | 5xx 응답 본문이 HTML이거나 비어 있음 | `ApiError`로 reject되고 `status`는 보존, `code="UNKNOWN_ERROR"`와 기본 메시지를 가진다 |
| TC-CLIENT-API-001-14 | 네트워크 오류 | `fetch` 자체가 reject (연결 실패) | `ApiError(code="NETWORK_ERROR")`로 통일해 reject한다 (호출부가 한 종류의 오류만 처리하면 되도록) |

---

### 3.15 boardUtils — 순수 로직 (API_SPEC §7, COMPONENT_SPEC §3.4·§3.6·§7)

> 파일 `src/client/lib/boardUtils.ts`, 테스트 `__tests__/lib/boardUtils.test.ts`. React와 무관한 순수 함수라 입력과 반환값만 검증한다. 보드를 바꾸는 함수는 입력 `BoardData`를 변경하지 않고 새 객체를 반환한다.
> 드롭 계산의 예시 보드: BACKLOG `[X=1024]`, TODO `[A=1024, B=2048, C=3072]`, IN_PROGRESS `[]`, DONE `[D=1024]`. 카드 위에 드롭하면 **그 카드가 있던 자리**에 놓인다 (위로 이동하면 그 카드 앞, 아래로 이동하면 그 카드 뒤).

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-CLIENT-UTIL-001-01 | 두 카드 사이 위치 | `calculatePosition(1024, 2048)` | `1536` |
| TC-CLIENT-UTIL-001-02 | 정수 간격이 없는 경우 | `calculatePosition(1024, 1025)` | `1025` (올림 결과가 next와 같은 값이 되며, 서버가 충돌 규칙으로 next 바로 앞에 놓는다) |
| TC-CLIENT-UTIL-001-03 | 맨 앞 | `calculatePosition(null, 1024)` | `0` (첫 카드 - 1024) |
| TC-CLIENT-UTIL-001-04 | 맨 뒤 | `calculatePosition(2048, null)` | `3072` (마지막 카드 + 1024) |
| TC-CLIENT-UTIL-001-05 | 빈 칼럼 | `calculatePosition(null, null)` | `1024` |
| TC-CLIENT-UTIL-001-06 | 다른 칼럼의 카드 위에 드롭 | BACKLOG의 X를 TODO의 B 위에 드롭 | `{ kind: "reorder", status: "TODO", position: 1536 }` (A와 B 사이) |
| TC-CLIENT-UTIL-001-07 | 칼럼의 빈 영역에 드롭 | X를 TODO 칼럼 영역(카드가 없는 곳)에 드롭 | `{ kind: "reorder", status: "TODO", position: 4096 }` (맨 뒤) |
| TC-CLIENT-UTIL-001-08 | 빈 칼럼에 드롭 | X를 카드 없는 IN_PROGRESS 칼럼에 드롭 | `{ kind: "reorder", status: "IN_PROGRESS", position: 1024 }` |
| TC-CLIENT-UTIL-001-09 | 같은 칼럼에서 위로 이동 | TODO의 C를 B 위에 드롭 (결과 순서 A, C, B) | `position: 1536` (이동 카드 자신은 이웃 계산에서 제외) |
| TC-CLIENT-UTIL-001-10 | 같은 칼럼에서 아래로 이동 | TODO의 A를 B 위에 드롭 (결과 순서 B, A, C) | `position: 2560` (B=2048과 C=3072 사이) |
| TC-CLIENT-UTIL-001-11 | 같은 칼럼 맨 앞으로 이동 | TODO의 C를 A 위에 드롭 | `position: 0` |
| TC-CLIENT-UTIL-001-12 | 다른 칼럼에서 DONE으로 | TODO의 B를 DONE 칼럼 또는 D 카드 위에 드롭 | `{ kind: "complete" }` |
| TC-CLIENT-UTIL-001-13 | DONE에서 다른 칼럼으로 | DONE의 D를 TODO 칼럼 영역에 드롭 | `{ kind: "reorder", status: "TODO", position: 4096 }` (DONE 이탈은 허용) |
| TC-CLIENT-UTIL-001-14 | 칼럼 간 이동 반영 (`moveTicket`) | X를 TODO, `position=1536`으로 이동 | 원래 칼럼에서 사라지고 TODO가 `[A, X, B, C]` 순서가 되며 X의 `status`/`position`이 반영된다 |
| TC-CLIENT-UTIL-001-15 | 원본 불변 | 위 이동 후 | 입력으로 넘긴 보드 객체는 바뀌지 않고 새 객체가 반환된다 |
| TC-CLIENT-UTIL-001-16 | 완료 낙관적 반영 (`completeInBoard`) | TODO의 B를 완료 처리 | DONE 맨 위(기존 최솟값 - 1024, 비어 있으면 1024)에 놓이고 `status="DONE"`, `completedAt`이 현재 시각으로 채워진다 |
| TC-CLIENT-UTIL-001-17 | 생성 반영 (`insertTicket`) | 새 티켓 추가 | BACKLOG 맨 위에 추가된다 |
| TC-CLIENT-UTIL-001-18 | 수정 반영 (`replaceTicket`) | 같은 `id`의 새 티켓 데이터 | 해당 카드만 교체되고 칼럼 내 순서는 유지된다 |
| TC-CLIENT-UTIL-001-19 | 삭제 반영 (`removeTicket`) | 존재하는 `id` | 해당 카드가 보드에서 제거된다 |
| TC-CLIENT-UTIL-001-20 | 변경된 필드만 추출 (`getChangedFields`) | 제목만 바꾼 폼 값 / 여러 필드를 바꾼 폼 값 | 바뀐 필드만 담긴 객체(`{ title }` / 바뀐 필드 전부)를 반환하고, 같은 값의 필드는 포함하지 않는다 |
| TC-CLIENT-UTIL-001-21 | 변경 없음 | 원본과 같은 폼 값 | 빈 객체 `{}`를 반환한다 |
| TC-CLIENT-UTIL-001-22 | 값을 비운 필드 | 설명 "설명" → 빈 문자열, 종료예정일 "2026-10-10" → 빈 값 | `{ description: null, dueDate: null }` (API_SPEC §4: `null`이면 값을 비움) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-CLIENT-UTIL-001-23 | 제자리 드롭 | TODO의 B를 B 자신 위에 드롭 | `resolveDropTarget`이 `null`을 반환한다 |
| TC-CLIENT-UTIL-001-24 | DONE 칼럼 안의 이동 | DONE의 D를 DONE 칼럼 또는 D 위에 드롭 | `null`을 반환한다 (DONE 내부 순서는 바꿀 수 없음) |
| TC-CLIENT-UTIL-001-25 | 드롭 대상 없음 | 드롭 대상(`over`)이 `null` | `null`을 반환한다 |
| TC-CLIENT-UTIL-001-26 | 존재하지 않는 id | `moveTicket`/`completeInBoard`/`replaceTicket`/`removeTicket`에 없는 `id` | 보드 내용이 그대로 반환된다 (오류 없음) |

---

### 3.16 useTickets — 보드 상태 훅 (COMPONENT_SPEC §3.5, §7)

> 파일 `src/client/hooks/useTickets.ts`, 테스트 `__tests__/hooks/useTickets.test.tsx`(`renderHook`, `ticketApi` mock). 화면 아래 계층이라 기대 결과를 **훅이 돌려주는 상태와 호출 결과**로 적는다. 화면에서 보이는 롤백은 TC-COMP-003-12가 검증한다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-HOOK-001-01 | 최초 조회 | `initialData` 없이 마운트 | `isLoading=true`로 시작하고, 보드 조회가 끝나면 `board`가 채워지고 `isLoading=false`가 된다 |
| TC-HOOK-001-02 | 초기 데이터 제공 | `initialData`를 전달 | 최초 조회를 하지 않고 그 값이 `board`가 되며 `isLoading=false`다 |
| TC-HOOK-001-03 | 다시 불러오기 | 조회 실패 상태에서 `refetch()`가 성공 | 보드를 다시 조회해 `board`가 채워지고 이전 `error`가 지워진다 |
| TC-HOOK-001-04 | 생성 성공 | `create({ title })`, 서버가 새 티켓 반환 | 새 티켓이 BACKLOG 맨 위에 추가된다 |
| TC-HOOK-001-05 | 수정 성공 | `update(id, 변경분)` | 보드의 해당 카드가 서버가 돌려준 값으로 교체된다 |
| TC-HOOK-001-06 | 삭제 성공 | `remove(id)` | 보드에서 해당 카드가 사라진다 |
| TC-HOOK-001-07 | 이동의 낙관적 반영 | `reorder(id, "TODO", 1536)` 호출 직후, API 응답 전 | 응답을 기다리지 않고 즉시 `board`가 새 칼럼·위치로 바뀐다 |
| TC-HOOK-001-08 | 이동 결과 확정 | `reorder`의 API 응답 수신 | `board`가 서버가 돌려준 보드로 교체된다 |
| TC-HOOK-001-09 | 완료의 낙관적 반영과 확정 | `complete(id)` 호출 | 즉시 DONE 칼럼 맨 위로 옮겨지고, 응답 후 서버 값(`completedAt` 포함)으로 확정된다 |
| TC-HOOK-001-10 | 오류 지우기 | `error`가 채워진 상태에서 `clearError()` | `error`가 `null`이 된다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-HOOK-001-11 | 초기 조회 실패 | 보드 조회가 실패 | `error`에 메시지가 채워지고 `isLoading=false`이며 `board`는 비어 있다 |
| TC-HOOK-001-12 | 생성·수정·삭제 실패 (필드가 있는 400) | `error.field="title"`인 400 응답 | `ApiError`로 reject되고 `error` 상태는 채워지지 않으며(필드 오류는 폼에서 인라인 표시) 보드는 그대로다 |
| TC-HOOK-001-13 | 생성·수정·삭제 실패 (그 외) | 500, 404, 필드 없는 400, 네트워크 오류 | `ApiError`로 reject되고 `error`에 메시지가 채워지며 보드는 그대로다 (삭제 실패 시 카드가 남는다) |
| TC-HOOK-001-14 | 이동 실패 | `reorder`의 API가 실패 | 낙관적으로 바꿨던 `board`가 호출 전 상태로 조용히 돌아가고, `error`는 채워지지 않으며 reject하지 않는다 |
| TC-HOOK-001-15 | 완료 실패 | `complete`의 API가 실패 | 위와 동일하게 DONE으로 옮겼던 카드가 원래 칼럼·위치로 돌아간다 |
| TC-HOOK-001-16 | 연속 이동 중 일부 실패 | 카드 A 이동 성공 후 카드 B 이동 실패 | B만 원래대로 돌아가고 A의 이동 결과는 유지된다 (스냅샷이 섞이지 않음) |
| TC-HOOK-001-17 | 같은 오류가 다시 발생 | `clearError()` 후 같은 실패가 다시 발생 | `error`가 다시 채워진다 (같은 메시지의 토스트가 다시 표시될 수 있음) |
| TC-HOOK-001-18 | 응답 도착 전 언마운트 | 요청 중에 훅이 언마운트됨 | 이후 응답이 도착해도 상태 갱신 경고나 오류가 발생하지 않는다 |

---

### 3.17 useTicket — 상세 조회 훅 (COMPONENT_SPEC §3.5, §6.2)

> 파일 `src/client/hooks/useTicket.ts`, 테스트 `__tests__/hooks/useTicket.test.tsx`. `TicketModal`이 오픈 시 최신 단건 데이터를 조회하는 데 쓴다.

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-HOOK-002-01 | 조회 | `useTicket(7)` | `isLoading=true`로 시작하고 응답 후 `ticket`이 채워지며 `isLoading=false`가 된다 |
| TC-HOOK-002-02 | id가 없음 | `useTicket(null)` | 조회하지 않고 `ticket=null`, `isLoading=false`다 |
| TC-HOOK-002-03 | id 변경 | 7에서 8로 변경 | 새 id로 다시 조회해 `ticket`이 8번 티켓으로 바뀐다 |
| TC-HOOK-002-04 | 모달 닫힘 | 7에서 `null`로 복귀 | `ticket`과 `error`가 비워진다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-HOOK-002-05 | 조회 실패 | 404 또는 500 응답 | `error`에 메시지가 채워지고 `ticket=null`, `isLoading=false`다 (TC-COMP-007-12의 기반) |
| TC-HOOK-002-06 | 응답 순서가 뒤바뀜 | 7을 요청한 뒤 끝나기 전에 8로 변경, 7의 응답이 8보다 늦게 도착 | 늦게 도착한 7의 응답은 무시되고 `ticket`은 8번 티켓이다 |

---

## 4. 통합 테스트 케이스

> 사용자 스토리(US) 단위로, 화면 조작부터 실제 API 호출·DB 반영까지 이어지는 전체 흐름을 검증한다.
> 컴포넌트 테스트가 "화면 조각 하나"를 본다면, 통합 테스트는 "한 시나리오 전체가 끝까지 연결되는지"를 본다.
> MVP에서는 이 섹션의 시나리오를 FRONTEND_TASKS.md P7의 **수동 점검**으로 수행한다. 영속성(새로고침 후 유지)은 API 테스트(§2)가, 낙관적 업데이트·롤백은 훅 테스트가 보증한다. 자동화 도구(Playwright 등) 도입은 별도 승인 후 결정한다.

### 4.1 US-001/US-002: 새 할 일 등록 (+ 상세 정보 설정)

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-001-01 | 제목만 입력해 생성 → 보드 반영 확인 | "새 업무" 클릭 → 제목 입력 → 생성 | 실제 `POST /api/tickets` 호출됨, 응답으로 받은 티켓이 BACKLOG 칼럼 최상단에 즉시 보인다 |
| TC-INT-001-02 | 모든 상세 필드를 채워 생성 후 재조회해도 유지되는지 | 설명/우선순위/시작예정일/종료예정일 모두 입력해 생성 → 페이지 새로고침 | 새로고침 후에도 동일한 내용의 카드가 BACKLOG에 보인다 (서버에 영속화됨) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-001-03 | 클라이언트 검증을 우회해 잘못된 값이 서버로 전달되는 경우 | 클라이언트 검증을 임시로 비활성화하고 과거 `dueDate`로 제출(서버 검증 단독 테스트) | 서버가 400을 반환하고, 화면에 에러가 표시되며 카드가 생성되지 않는다 |

---

### 4.2 US-003/US-004: 칸반 보드 현황 파악 + 마감 초과 인지

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-002-01 | 여러 상태에 걸쳐 시드된 데이터로 보드 진입 | DATA_MODEL.md §6 시드 데이터 기준 DB 준비 | 4개 칼럼에 각각 올바른 티켓이 분류되어 보이고, 오버듀 대상 티켓에는 지연 표시가 함께 보인다 |
| TC-INT-002-02 | 시간 경과로 오버듀 상태가 된 티켓을 재조회 | 생성 시점엔 미래였던 `dueDate`가 시간 경과로 과거가 됨 → 페이지 새로고침 | 새로고침 후 해당 카드에 지연 표시가 새로 나타난다 (서버 재연산 반영) |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-002-03 | 서버가 완전히 응답하지 않는 상태에서 보드 진입 | 목록 조회 API를 지연/실패로 모킹 | 로딩 스켈레톤 이후 에러 화면으로 전환되고, 재시도로 복구 가능함을 끝까지 확인 |

---

### 4.3 US-005/US-006: 드래그앤드롭 상태 변경 + 완료 처리

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-003-01 | BACKLOG → TODO로 드래그 → 새로고침해도 유지 | 카드 드래그 후 페이지 새로고침 | 새로고침 후에도 카드가 TODO 칼럼에 위치하며, 상세 모달에서 시작일이 기록되어 있다 |
| TC-INT-003-02 | TODO → DONE으로 드래그 → Done 칼럼에서 확인 | 카드를 DONE으로 드래그 | 카드가 DONE 칼럼 최상단에 보이고, 상세 모달에서 종료일이 기록되어 있다 |
| TC-INT-003-03 | DONE → BACKLOG로 되돌리기 → completedAt 초기화 확인 | DONE 카드를 BACKLOG로 드래그 후 상세 모달 열기 | 종료일 표시가 사라져 있다 (completedAt=null 반영 확인) |
| TC-INT-003-04 | 같은 칼럼 내 순서 변경 후 새로고침해도 순서 유지 | 같은 칼럼에서 카드 순서 변경 → 새로고침 | 변경한 순서 그대로 카드가 다시 보인다 |
| TC-INT-003-05 | 24시간 경과 후 DONE 카드가 보드에서 사라지는지 | `completedAt`을 25시간 전으로 설정한 뒤 보드 재조회 | 해당 카드가 DONE 칼럼에서 보이지 않지만, 카드 클릭 기록(상세 URL 등)으로는 여전히 조회 가능 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-003-06 | 이동 처리 중 네트워크 오류 발생 | 드래그 직후 API 요청을 네트워크 오류로 모킹 | 카드가 원래 칼럼/위치로 되돌아가고, 실제 DB 상태도 변경되지 않았음을 재조회로 확인 |

---

### 4.4 US-007: 할 일 수정

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-004-01 | 카드 클릭 → 수정 → 저장 → 보드/새로고침 양쪽에서 반영 확인 | 상세 모달에서 제목/우선순위 변경 후 저장, 이어서 새로고침 | 저장 직후 보드에 즉시 반영되고, 새로고침 후에도 변경 내용이 유지된다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-004-02 | 두 사용자가 동시에 같은 티켓을 수정하는 상황(단일 사용자 MVP이므로 순차 재현) | 첫 저장 후 오래된 상세 화면에서 다른 값으로 재저장 | 나중 저장이 반영되고, 필드별 부분 업데이트라 서로 겹치지 않는 필드는 두 저장 내용이 모두 남는다 |

---

### 4.5 US-008: 할 일 삭제

**정상 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-005-01 | 카드 삭제 → 보드에서 제거 → 새로고침해도 재등장하지 않음 | 상세 모달 → 삭제 → 확인 → 새로고침 | 삭제 직후 보드에서 사라지고, 새로고침 후에도 다시 나타나지 않는다 (서버에서 완전 삭제 확인) |
| TC-INT-005-02 | 완료 처리 후 이어서 삭제 → 보드/재조회 양쪽에서 반영 확인 | 카드를 DONE으로 드래그 → 상세 모달 열기 → 삭제 → 확인 → 새로고침 | 완료 직후 DONE 칼럼 최상단에 보이던 카드가 삭제 후 사라지고, 새로고침 후에도 다시 나타나지 않는다 (완료 처리와 삭제가 이어져도 각 단계가 올바르게 누적 반영됨) |
| TC-INT-005-03 | 삭제된 티켓을 상세 조회 시도 | 삭제한 티켓의 ID로 직접 상세 API 호출 | 404 응답을 받으며, 화면에서도 해당 티켓 관련 정보를 찾을 수 없다 |

**예외 케이스**

| 번호 | 시나리오 | 조건 | 기대 결과 |
|------|------|------|------|
| TC-INT-005-04 | 삭제 확인 다이얼로그에서 취소 후 실제로 삭제되지 않았는지 재조회로 확인 | 삭제 시도 → 취소 → 새로고침 | 새로고침 후에도 카드가 그대로 보드에 남아있다 |

---

## 5. 테스트 실행 우선순위

> TDD 순서(CLAUDE.md)에 따라 어떤 케이스부터 Red → Green으로 구현해나갈지의 권장 순서다. FR/US 커버리지(§0 추적 매트릭스)는 "무엇을 테스트하는가"를, 이 섹션은 "어떤 순서로 만드는가"를 다룬다.

**Phase 1 (핵심 — 백엔드 API)**
- TC-API-001 (생성), TC-API-002 (목록 조회), TC-API-007 (reorder), TC-API-005 (완료)
- 이유: 보드의 기본 동작인 생성, 조회, 상태 이동이 우선

**Phase 2 (보완 — 백엔드 API + 컴포넌트)**
- TC-API-003 (상세 조회), TC-API-004 (수정), TC-API-006 (삭제), TC-API-008 (오버듀)
- TC-CLIENT-API-001 (ticketApi), TC-CLIENT-UTIL-001 (boardUtils), TC-HOOK-001~002 (useTickets, useTicket) — 컴포넌트가 의존하는 하위 계층이므로 컴포넌트보다 먼저
- TC-COMP-001 (TicketCard), TC-COMP-002 (Column), TC-COMP-003 (Board)
- 이유: CRUD 완성 + 핵심 UI 렌더링

**Phase 3 (폼 + 모달)**
- TC-COMP-009~013 (Modal/Badge/Button, ConfirmDialog, 상태·오류 표시, ErrorToast, 배지 단독 — 공통 primitive·보조 컴포넌트) → TC-COMP-006 (TicketFormModal), TC-COMP-007 (TicketModal/TicketDetailView/TicketForm), TC-COMP-008 (DeleteButton/ConfirmDialog)
- 이유: 사용자 입력 UI. 공통 primitive를 먼저 검증해두면 이를 감싸는 상위 컴포넌트(TicketFormModal 등) 구현이 더 안정적으로 진행된다

**Phase 4 (통합)**
- TC-INT-003 (드래그앤드롭·완료 처리), TC-INT-005 (삭제, 완료→삭제 연쇄 흐름 포함)
- 이유: 전체 기능이 구현된 후 end-to-end 검증

---
