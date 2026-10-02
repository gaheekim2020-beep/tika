# CODE_MAP — 테스트 케이스 ↔ 구현 코드 연결표

> 코드 리뷰용 색인이다. TEST_CASES.md의 TC 번호 하나를 기준으로, 그 케이스를 검증하는 테스트와 동작을 구현한 코드의 위치를 한 줄에 모았다.
> 링크의 `#L숫자`는 줄 번호라서 코드가 바뀌면 어긋날 수 있다. 어긋나면 함수/테스트 이름으로 검색한다.
> 테스트 파일: [__tests__/api/tickets.test.ts](../__tests__/api/tickets.test.ts) (API), [__tests__/services/ticketService.test.ts](../__tests__/services/ticketService.test.ts) (서비스). 한 테스트가 여러 TC를 함께 검증하면 "(03·04 공용)"처럼 표시했다.
> US ↔ TC 연결은 TEST_CASES.md §0에 있다. 이 문서는 TC ↔ 코드 연결만 다룬다.

## POST /api/tickets (US-001·002, FR-001) — specs/001-create-ticket-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`POST`](../app/api/tickets/route.ts#L17) |
| 검증 스키마 | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| 서비스 | [`createTicket`](../src/server/services/ticketService.ts#L64), [`getNextBacklogPosition`](../src/server/services/ticketService.ts#L50) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-001-01 | 제목만으로 생성 | [제목만 입력하면 201…](../__tests__/api/tickets.test.ts#L52) | - | [201 응답](../app/api/tickets/route.ts#L36) | [`createTicket`](../src/server/services/ticketService.ts#L64) |
| TC-API-001-02 | 모든 필드 생성 | [모든 필드를 채워 생성…](../__tests__/api/tickets.test.ts#L114) | - | [201 응답](../app/api/tickets/route.ts#L36) | [`createTicket`](../src/server/services/ticketService.ts#L64) |
| TC-API-001-03 | BACKLOG 비어 있으면 position=1024 | - | [비어 있으면 1024](../__tests__/services/ticketService.test.ts#L26) | - | [`getNextBacklogPosition`](../src/server/services/ticketService.ts#L50) |
| TC-API-001-04 | 기존 티켓 있으면 최솟값-1024 | - | [최솟값이 0이면 -1024](../__tests__/services/ticketService.test.ts#L31) | - | [`getNextBacklogPosition`](../src/server/services/ticketService.ts#L50) |
| TC-API-001-05 | description 미입력 → null | [description을 생략하면 null](../__tests__/api/tickets.test.ts#L142) | - | [201 응답](../app/api/tickets/route.ts#L36) | [`createTicket`](../src/server/services/ticketService.ts#L64) |
| TC-API-001-06 | priority 미입력 → MEDIUM | [priority를 생략하면 MEDIUM](../__tests__/api/tickets.test.ts#L151) | - | [201 응답](../app/api/tickets/route.ts#L36) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-07 | 제목 누락 | [제목이 없으면 400](../__tests__/api/tickets.test.ts#L75) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-08 | 제목 공백만 | [제목이 공백만 있으면 400](../__tests__/api/tickets.test.ts#L88) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-09 | 제목 200자 초과 | [제목이 200자를 초과하면 400](../__tests__/api/tickets.test.ts#L101) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-10 | 설명 1000자 초과 | [description이 1000자를 초과하면 400](../__tests__/api/tickets.test.ts#L160) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-11 | 잘못된 priority | [priority가 허용값 외이면 400](../__tests__/api/tickets.test.ts#L175) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-12 | 과거 종료예정일 | [dueDate가 과거 날짜이면 400](../__tests__/api/tickets.test.ts#L190) | - | [VALIDATION_ERROR 400](../app/api/tickets/route.ts#L21) | [`createTicketSchema`](../src/shared/validations/ticket.ts#L11) |
| TC-API-001-13 | 서비스 예외 → 500 | [서비스 계층에서 예외가 발생하면 500](../__tests__/api/tickets.test.ts#L212) | - | [INTERNAL_ERROR 500](../app/api/tickets/route.ts#L37) | - |

## GET /api/tickets (US-003, FR-002·008) — specs/002-list-tickets-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`GET`](../app/api/tickets/route.ts#L5) |
| 서비스 | [`getBoardData`](../src/server/services/ticketService.ts#L155) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-002-01 | 4개 상태 그룹화 | - | [4개 키로 그룹화](../__tests__/services/ticketService.test.ts#L61) | [200 응답](../app/api/tickets/route.ts#L8) | [`getBoardData`](../src/server/services/ticketService.ts#L155) |
| TC-API-002-02 | 칼럼 내 position 오름차순 | - | [position 오름차순 정렬](../__tests__/services/ticketService.test.ts#L84) | [200 응답](../app/api/tickets/route.ts#L8) | [`getBoardData`](../src/server/services/ticketService.ts#L155) |
| TC-API-002-03 | 티켓 0개 → 빈 배열 4개 | [4개 빈 배열 키를 반환](../__tests__/api/tickets.test.ts#L243) | [4개 키 모두 빈 배열](../__tests__/services/ticketService.test.ts#L101) | [200 응답](../app/api/tickets/route.ts#L8) | [`getBoardData`](../src/server/services/ticketService.ts#L155) |
| TC-API-002-04 | DONE 24시간 이내 포함 | - | [24시간 이내 포함 / 초과 제외 (04·05 공용)](../__tests__/services/ticketService.test.ts#L113) | [200 응답](../app/api/tickets/route.ts#L8) | [`getBoardData`](../src/server/services/ticketService.ts#L155) |
| TC-API-002-05 | DONE 24시간 초과 제외 | - | [24시간 이내 포함 / 초과 제외 (04·05 공용)](../__tests__/services/ticketService.test.ts#L113) | [200 응답](../app/api/tickets/route.ts#L8) | [`getBoardData`](../src/server/services/ticketService.ts#L155) |
| TC-API-002-06 | 서비스 예외 → 500 | [서비스 계층에서 예외가 발생하면 500](../__tests__/api/tickets.test.ts#L303) | - | [INTERNAL_ERROR 500](../app/api/tickets/route.ts#L9) | - |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [`calculateIsOverdue` 3건 (DONE이면 false / dueDate null / 과거면 true)](../__tests__/services/ticketService.test.ts#L44)

## GET /api/tickets/:id (US-003, FR-003) — specs/003-get-ticket-detail

| 계층 | 위치 |
|------|------|
| Route Handler | [`GET`](../app/api/tickets/[id]/route.ts#L23) |
| 검증 스키마 | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| 서비스 | [`getTicketById`](../src/server/services/ticketService.ts#L87) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-003-01 | 존재하는 티켓 조회 | [존재하는 id로 조회하면 200](../__tests__/api/tickets.test.ts#L334) | [전체 필드와 isOverdue 반환](../__tests__/services/ticketService.test.ts#L137) | [200 응답](../app/api/tickets/[id]/route.ts#L50) | [`getTicketById`](../src/server/services/ticketService.ts#L87) |
| TC-API-003-02 | 24시간 지난 DONE도 조회됨 | [24시간을 초과한 DONE도 200](../__tests__/api/tickets.test.ts#L356) | [24시간 초과 DONE도 반환](../__tests__/services/ticketService.test.ts#L156) | [200 응답](../app/api/tickets/[id]/route.ts#L50) | [`getTicketById`](../src/server/services/ticketService.ts#L87) |
| TC-API-003-03 | ID 정수 아님 | [it.each abc/-1/0 (03·04 공용)](../__tests__/api/tickets.test.ts#L378) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L32) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-003-04 | ID 0 / 음수 | [it.each abc/-1/0 (03·04 공용)](../__tests__/api/tickets.test.ts#L378) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L32) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-003-05 | 존재하지 않는 ID | [존재하지 않는 id → 404 (05·06 공용)](../__tests__/api/tickets.test.ts#L393) | [없는 id면 null](../__tests__/services/ticketService.test.ts#L174) | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/route.ts#L40) | [`getTicketById`](../src/server/services/ticketService.ts#L87) |
| TC-API-003-06 | 이미 삭제된 ID | [존재하지 않는 id → 404 (05·06 공용)](../__tests__/api/tickets.test.ts#L393) | - | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/route.ts#L40) | [`getTicketById`](../src/server/services/ticketService.ts#L87) |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [GET /:id 서비스 예외 → 500](../__tests__/api/tickets.test.ts#L926) — Route의 [INTERNAL_ERROR 500](../app/api/tickets/[id]/route.ts#L51)

## PATCH /api/tickets/:id (US-007, FR-003·004) — specs/004-update-ticket-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`PATCH`](../app/api/tickets/[id]/route.ts#L59) |
| 검증 스키마 | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43), [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| 서비스 | [`updateTicket`](../src/server/services/ticketService.ts#L92) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-004-01 | 제목만 수정 | [제목만 수정하면 200](../__tests__/api/tickets.test.ts#L432) | [제목만 바뀌고 나머지 유지](../__tests__/services/ticketService.test.ts#L199) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-02 | 여러 필드 동시 수정 | [여러 필드를 동시에 수정](../__tests__/api/tickets.test.ts#L454) | [전달한 필드가 모두 반영](../__tests__/services/ticketService.test.ts#L216) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-03 | description null 초기화 | [description을 null로 전달](../__tests__/api/tickets.test.ts#L496) | [설명이 비워진다](../__tests__/services/ticketService.test.ts#L268) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-04 | plannedStartDate null 초기화 | [plannedStartDate를 null로 전달](../__tests__/api/tickets.test.ts#L507) | [시작예정일이 비워진다](../__tests__/services/ticketService.test.ts#L277) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-05 | 빈 body | [빈 body면 200](../__tests__/api/tickets.test.ts#L521) | [updatedAt만 갱신](../__tests__/services/ticketService.test.ts#L296) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-06 | 제목 공백만 | [제목을 공백만으로 수정하면 400](../__tests__/api/tickets.test.ts#L559) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-07 | 제목 200자 초과 | [제목이 201자면 400](../__tests__/api/tickets.test.ts#L574) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-08 | 설명 1000자 초과 | [설명이 1001자면 400](../__tests__/api/tickets.test.ts#L592) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-09 | 잘못된 priority | [잘못된 우선순위면 400](../__tests__/api/tickets.test.ts#L610) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-10 | 과거 종료예정일 | [종료예정일이 어제면 400](../__tests__/api/tickets.test.ts#L628) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-11 | 존재하지 않는 티켓 | [존재하지 않는 id로 수정하면 404](../__tests__/api/tickets.test.ts#L703) | [없는 id면 null](../__tests__/services/ticketService.test.ts#L311) | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/route.ts#L101) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-12 | status/position 무시 | [status/position이 있어도 무시](../__tests__/api/tickets.test.ts#L480) | - | [`PATCH`](../app/api/tickets/[id]/route.ts#L59) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-13 | ID 정수 아님 | [it.each abc/-1/0 (13·14 공용)](../__tests__/api/tickets.test.ts#L691) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L66) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-004-14 | ID 0 / 음수 | [it.each abc/-1/0 (13·14 공용)](../__tests__/api/tickets.test.ts#L691) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L66) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-004-15 | dueDate null 초기화 + isOverdue 재계산 | [dueDate를 null로 전달](../__tests__/api/tickets.test.ts#L539) | [isOverdue가 false로 재계산](../__tests__/services/ticketService.test.ts#L286) | [200 응답](../app/api/tickets/[id]/route.ts#L112) | [`updateTicket`](../src/server/services/ticketService.ts#L92) |
| TC-API-004-16 | 일부만 무효여도 전체 거절 | [하나만 무효여도 400](../__tests__/api/tickets.test.ts#L650) | - | [VALIDATION_ERROR 400](../app/api/tickets/[id]/route.ts#L82) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-17 | JSON 아님 / 객체 아님 | [it.each 본문 형식 오류](../__tests__/api/tickets.test.ts#L668) | - | [본문 JSON 파싱 실패 처리](../app/api/tickets/[id]/route.ts#L74) | [`updateTicketSchema`](../src/shared/validations/ticket.ts#L43) |
| TC-API-004-18 | 서비스 예외 → 500 | [서비스 계층에서 예외가 발생하면 500](../__tests__/api/tickets.test.ts#L949) | - | [INTERNAL_ERROR 500](../app/api/tickets/[id]/route.ts#L113) | - |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [수정하면 updatedAt이 이후 시각으로 갱신](../__tests__/services/ticketService.test.ts#L236)
- [과거 종료예정일 수정 시 isOverdue=true 재계산](../__tests__/services/ticketService.test.ts#L244)
- [DONE 티켓 수정해도 status·completedAt 유지](../__tests__/services/ticketService.test.ts#L254)

## PATCH /api/tickets/:id/complete (US-006, FR-005) — specs/005-complete-ticket-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`PATCH`](../app/api/tickets/[id]/complete/route.ts#L5) |
| 검증 스키마 | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| 서비스 | [`completeTicket`](../src/server/services/ticketService.ts#L120) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-005-01 | TODO 티켓 완료 | [TODO 티켓을 완료하면 200](../__tests__/api/tickets.test.ts#L744) | [TODO 티켓을 완료하면 DONE](../__tests__/services/ticketService.test.ts#L341) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-02 | IN_PROGRESS 티켓 완료 | [IN_PROGRESS 티켓을 완료하면 200](../__tests__/api/tickets.test.ts#L762) | [IN_PROGRESS 티켓을 완료하면 DONE](../__tests__/services/ticketService.test.ts#L356) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-03 | DONE 칼럼 비어 있으면 position=1024 | [DONE 칼럼에 티켓이 없으면 1024](../__tests__/api/tickets.test.ts#L860) | [티켓이 없으면 1024](../__tests__/services/ticketService.test.ts#L433) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-04 | 기존 DONE 있으면 맨 위 배치 | [최솟값이 1024이면 1024보다 작다](../__tests__/api/tickets.test.ts#L871) | [최솟값이 1024이면 0으로 맨 위](../__tests__/services/ticketService.test.ts#L442) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-05 | ID 형식 오류 | [it.each abc/-1/0 (05·10 공용)](../__tests__/api/tickets.test.ts#L901) | - | [INVALID_ID 400](../app/api/tickets/[id]/complete/route.ts#L12) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-005-06 | 존재하지 않는 티켓 | [존재하지 않는 id로 완료를 요청하면 404](../__tests__/api/tickets.test.ts#L913) | [없는 id면 null](../__tests__/services/ticketService.test.ts#L493) | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/complete/route.ts#L21) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-07 | 이미 DONE (멱등) | [이미 DONE인 티켓을 다시 완료하면 200](../__tests__/api/tickets.test.ts#L807) | [completedAt·position·updatedAt 불변](../__tests__/services/ticketService.test.ts#L396) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-08 | BACKLOG 티켓 완료 | [BACKLOG 티켓을 완료하면 200](../__tests__/api/tickets.test.ts#L774) | [startedAt은 null 유지](../__tests__/services/ticketService.test.ts#L365) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-09 | 다른 필드 불변 | [완료해도 …요청 전과 같다](../__tests__/api/tickets.test.ts#L787) | [완료해도 …변하지 않는다](../__tests__/services/ticketService.test.ts#L378) | [200 응답](../app/api/tickets/[id]/complete/route.ts#L32) | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-10 | ID 0 / 음수 | [it.each abc/-1/0 (05·10 공용)](../__tests__/api/tickets.test.ts#L901) | - | [INVALID_ID 400](../app/api/tickets/[id]/complete/route.ts#L12) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-005-11 | 본문 무시 | [깨진 JSON 본문을 보내도 200](../__tests__/api/tickets.test.ts#L828) | - | [`PATCH` (본문을 읽지 않음)](../app/api/tickets/[id]/complete/route.ts#L5) | - |
| TC-API-005-12 | 완료 직후 보드 반영 | [DONE 배열 맨 앞에 나타난다](../__tests__/api/tickets.test.ts#L847) | - | - | [`completeTicket`](../src/server/services/ticketService.ts#L120) |
| TC-API-005-13 | 서비스 예외 → 500 | [서비스 계층에서 예외가 발생하면 500](../__tests__/api/tickets.test.ts#L972) | - | [INTERNAL_ERROR 500](../app/api/tickets/[id]/complete/route.ts#L33) | - |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [같은 티켓을 동시에 두 번 완료해도 덮어써지지 않는다](../__tests__/services/ticketService.test.ts#L417)
- [연달아 완료하면 나중 티켓의 position이 더 작다](../__tests__/services/ticketService.test.ts#L457)
- [보드에서 숨겨진 DONE 행도 최솟값 계산에 포함](../__tests__/services/ticketService.test.ts#L468)
- TC-API-008-09 (완료 시 isOverdue=false): [API](../__tests__/api/tickets.test.ts#L888) / [서비스](../__tests__/services/ticketService.test.ts#L483)

## DELETE /api/tickets/:id (US-008, FR-006) — specs/006-delete-ticket-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`DELETE`](../app/api/tickets/[id]/route.ts#L121) |
| 검증 스키마 | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| 서비스 | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-006-01 | 존재하는 티켓 삭제 → 204 | [존재하는 티켓을 삭제하면 204…](../__tests__/api/tickets.test.ts#L1018) | [true를 반환하고 이후 조회하면 null](../__tests__/services/ticketService.test.ts#L521) | [204 응답](../app/api/tickets/[id]/route.ts#L148) | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-02 | Hard Delete 확인 | [DB를 직접 조회하면 행이 남아 있지 않다](../__tests__/api/tickets.test.ts#L1081) | [Hard Delete](../__tests__/services/ticketService.test.ts#L551) | - | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-03 | ID 형식 오류 `"abc"` | [id가 %s이면 400 INVALID_ID (it.each)](../__tests__/api/tickets.test.ts#L1130) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L127) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) |
| TC-API-006-04 | 없는 티켓 → 404 | [존재하지 않는 id로 삭제하면 404](../__tests__/api/tickets.test.ts#L1106) | [false를 반환하고 다른 티켓은 삭제되지 않는다](../__tests__/services/ticketService.test.ts#L589) | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/route.ts#L137) | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-05 | 이미 삭제된 티켓 재삭제 → 404 | [이미 삭제한 티켓을 다시 삭제하면 404](../__tests__/api/tickets.test.ts#L1118) | [연달아 삭제하면 첫 번째만 true](../__tests__/services/ticketService.test.ts#L598) | [TICKET_NOT_FOUND 404](../app/api/tickets/[id]/route.ts#L137) | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-06 | ID 0 / 음수 | [id가 %s이면 400 INVALID_ID (it.each)](../__tests__/api/tickets.test.ts#L1130) | - | [INVALID_ID 400](../app/api/tickets/[id]/route.ts#L127) | [`ticketIdParamSchema`](../src/shared/validations/ticket.ts#L39) (`.positive()`) |
| TC-API-006-07 | 깨진 JSON 본문이어도 204 | [깨진 JSON 본문을 보내도…204](../__tests__/api/tickets.test.ts#L1050) | - | [`DELETE`](../app/api/tickets/[id]/route.ts#L121) (본문을 읽지 않음) | - |
| TC-API-006-08 | 다른 티켓 불변 | [같은 칼럼의 다른 티켓의 내용과 position은 그대로](../__tests__/api/tickets.test.ts#L1091) | [재정렬 없이 그대로](../__tests__/services/ticketService.test.ts#L560) | - | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-09 | 삭제 직후 보드 조회 반영 | [보드 조회의 어느 칼럼에도 없다](../__tests__/api/tickets.test.ts#L1062) | - | - | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-10 | 모든 상태 삭제 | [it.each 4개 상태](../__tests__/api/tickets.test.ts#L1034) | [it.each](../__tests__/services/ticketService.test.ts#L531) | - | [`deleteTicket`](../src/server/services/ticketService.ts#L145) |
| TC-API-006-11 | 서비스 예외 → 500 | [서비스 계층에서 예외가 발생하면 500](../__tests__/api/tickets.test.ts#L1147) | - | [INTERNAL_ERROR 500](../app/api/tickets/[id]/route.ts#L150) | - |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [다른 칼럼의 티켓은 영향받지 않는다](../__tests__/services/ticketService.test.ts#L576)
- [같은 id를 동시에 삭제하면 한쪽만 true다](../__tests__/services/ticketService.test.ts#L608) — `RETURNING` 기반 판정 검증

---

## PATCH /api/tickets/reorder (US-005, FR-007) — specs/007-reorder-ticket-api

| 계층 | 위치 |
|------|------|
| Route Handler | [`PATCH`](../app/api/tickets/reorder/route.ts#L16) |
| 검증 스키마 | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| 서비스 | [`reorderTicket`](../src/server/services/ticketService.ts#L178), 시각 규칙 [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |

| TC | 시나리오 | API 테스트 | 서비스 테스트 | Route 동작 | 스키마 / 서비스 |
|----|------|------|------|------|------|
| TC-API-007-01 | 같은 칼럼 두 카드 사이로 이동 | [두 티켓 사이 값으로 이동](../__tests__/api/tickets.test.ts#L1202) | [요청한 position 저장](../__tests__/services/ticketService.test.ts#L651) | [200 응답](../app/api/tickets/reorder/route.ts#L66) | [충돌 없음 분기](../src/server/services/ticketService.ts#L209) |
| TC-API-007-02 | 칼럼 맨 앞으로 이동 | [맨 앞 값으로 이동](../__tests__/api/tickets.test.ts#L1216) | [맨 앞이 된다](../__tests__/services/ticketService.test.ts#L664) | - | [충돌 없음 분기](../src/server/services/ticketService.ts#L209) |
| TC-API-007-03 | 칼럼 맨 뒤로 이동 | [맨 뒤 값으로 이동](../__tests__/api/tickets.test.ts#L1229) | [마지막이 된다](../__tests__/services/ticketService.test.ts#L675) | - | [충돌 없음 분기](../src/server/services/ticketService.ts#L209) |
| TC-API-007-04 | 충돌 시 1024 간격 재정렬 (이동 티켓이 앞) | [기존 티켓과 같으면 재정렬](../__tests__/api/tickets.test.ts#L1242) | [재정렬](../__tests__/services/ticketService.test.ts#L718), [인접 정수 1024/1025](../__tests__/services/ticketService.test.ts#L731) | - | [`ordered` 재할당](../src/server/services/ticketService.ts#L218) |
| TC-API-007-05 | BACKLOG → TODO, startedAt 기록 | [startedAt 기록](../__tests__/api/tickets.test.ts#L1340) | [현재 시각 설정](../__tests__/services/ticketService.test.ts#L784) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-06 | BACKLOG → IN_PROGRESS 직접 이동 | [직접 이동](../__tests__/api/tickets.test.ts#L1356) | [직접 이동](../__tests__/services/ticketService.test.ts#L798) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-07 | 기존 startedAt 유지 | [startedAt 유지](../__tests__/api/tickets.test.ts#L1370) | [TODO ↔ IN_PROGRESS](../__tests__/services/ticketService.test.ts#L812) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-08 | TODO → BACKLOG, startedAt 초기화 | [startedAt=null](../__tests__/api/tickets.test.ts#L1384) | [startedAt=null](../__tests__/services/ticketService.test.ts#L824) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-25 | IN_PROGRESS·DONE → BACKLOG | [it.each 2개 상태](../__tests__/api/tickets.test.ts#L1396) | [IN_PROGRESS](../__tests__/services/ticketService.test.ts#L833), [DONE](../__tests__/services/ticketService.test.ts#L845) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-09 | DONE → 다른 칼럼, completedAt 초기화 | [DONE → TODO](../__tests__/api/tickets.test.ts#L1415) | [it.each 3개 칼럼](../__tests__/services/ticketService.test.ts#L860) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-10 | DONE 아닌 칼럼 간 이동 | [completedAt 계속 null](../__tests__/api/tickets.test.ts#L1431) | [completedAt 계속 null](../__tests__/services/ticketService.test.ts#L890) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-11 | 대상 status가 DONE → 400 (field 없음) | [DONE 거절](../__tests__/api/tickets.test.ts#L1497) | - | [status 분기](../app/api/tickets/reorder/route.ts#L34) | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| TC-API-007-12 | 허용되지 않는 status 문자열 | [ARCHIVED 거절](../__tests__/api/tickets.test.ts#L1510) | - | [status 분기](../app/api/tickets/reorder/route.ts#L34) | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| TC-API-007-13 | 없는 ticketId → 404 | [404 TICKET_NOT_FOUND](../__tests__/api/tickets.test.ts#L1535) | [null 반환](../__tests__/services/ticketService.test.ts#L962) | [404 응답](../app/api/tickets/reorder/route.ts#L55) | [`reorderTicket`](../src/server/services/ticketService.ts#L178) |
| TC-API-007-14 | 트랜잭션 원자성 (롤백) | - | [두 번째 UPDATE 실패 시 롤백](../__tests__/services/ticketService.test.ts#L978) | - | [`db.transaction`](../src/server/services/ticketService.ts#L184) |
| TC-API-007-15 | ticketId 형식 오류 | [it.each 4개 값](../__tests__/api/tickets.test.ts#L1547) | - | [field 포함 400](../app/api/tickets/reorder/route.ts#L45) | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| TC-API-007-16 | position 형식·범위 오류 | [it.each 4개 값](../__tests__/api/tickets.test.ts#L1566) | - | [field 포함 400](../app/api/tickets/reorder/route.ts#L45) | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| TC-API-007-17 | 본문이 JSON이 아니거나 객체가 아님 | [it.each 2개 본문](../__tests__/api/tickets.test.ts#L1585) | - | [본문 오류 400](../app/api/tickets/reorder/route.ts#L29) | - |
| TC-API-007-18 | status 누락 | [status 누락](../__tests__/api/tickets.test.ts#L1522) | - | [status 분기](../app/api/tickets/reorder/route.ts#L34) | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) |
| TC-API-007-19 | 같은 칼럼 같은 위치로 이동 | [배치 그대로](../__tests__/api/tickets.test.ts#L1257) | [충돌 아님](../__tests__/services/ticketService.test.ts#L707) | - | [자기 자신 제외](../src/server/services/ticketService.ts#L197) |
| TC-API-007-20 | 빈 칼럼으로 이동 | [유일한 항목](../__tests__/api/tickets.test.ts#L1270) | [요청 position 저장](../__tests__/services/ticketService.test.ts#L697) | - | [충돌 없음 분기](../src/server/services/ticketService.ts#L209) |
| TC-API-007-21 | 다른 필드 불변 | [다른 키가 와도 불변](../__tests__/api/tickets.test.ts#L1282) | [필드 불변·updatedAt 갱신](../__tests__/services/ticketService.test.ts#L758) | - | [`reorderTicketSchema`](../src/shared/validations/ticket.ts#L78) (정의되지 않은 키 제거) |
| TC-API-007-22 | 서비스 예외 → 500 | [500 INTERNAL_ERROR](../__tests__/api/tickets.test.ts#L1608) | - | [INTERNAL_ERROR 500](../app/api/tickets/reorder/route.ts#L67) | - |
| TC-API-007-23 | 보드 목록과 같은 응답 형식 | [wrapper 없는 4개 키](../__tests__/api/tickets.test.ts#L1313) | [4개 칼럼 보드 반환](../__tests__/services/ticketService.test.ts#L685) | [200 응답](../app/api/tickets/reorder/route.ts#L66) | [`getBoardData`](../src/server/services/ticketService.ts#L247) |
| TC-API-007-24 | 숨겨진 DONE 티켓 이동 | [completedAt=null, TODO에 나타남](../__tests__/api/tickets.test.ts#L1448) | [숨겨진 DONE 이동](../__tests__/services/ticketService.test.ts#L901) | - | [`getReorderTimestampChanges`](../src/server/services/ticketService.ts#L158) |
| TC-API-007-26 | 충돌 재정렬이 다른 칼럼에 영향 없음 | - | [다른 칼럼 불변](../__tests__/services/ticketService.test.ts#L743) | - | [대상 칼럼만 조회](../src/server/services/ticketService.ts#L197) |

**TC 번호가 없는 테스트** (해당 계층 고유 검증)
- [startedAt이 있는 DONE 티켓을 TODO로 이동하면 startedAt은 유지된다](../__tests__/services/ticketService.test.ts#L876)
- [BACKLOG 안에서 순서만 바꾸면 startedAt은 null로 유지된다](../__tests__/services/ticketService.test.ts#L914)
- [충돌 재정렬 경로로 이동해도 startedAt이 null이면 현재 시각이 되고 completedAt은 null이 된다](../__tests__/services/ticketService.test.ts#L923)
- [충돌 재정렬 경로에서도 이미 있는 startedAt은 유지되고 completedAt만 null이 된다](../__tests__/services/ticketService.test.ts#L943)
