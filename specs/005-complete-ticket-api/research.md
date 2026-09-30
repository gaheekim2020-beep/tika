# Research: 티켓 완료 처리 API

Technical Context에 `NEEDS CLARIFICATION`은 없었다. 구현 방식 선택이 필요했던 지점과, 문서/코드
사이에서 발견한 사항을 정리한다. "확인 결과"는 실제 코드와 문서를 열어 본 사실이고, "미검증"
표시는 구현 단계 테스트로 확인해야 하는 항목이다.

## Decision: 멱등 처리는 `UPDATE ... WHERE id = ? AND status <> 'DONE'` 가드로 한다

**Decision**: `completeTicket`은 `db.update(tickets).set(...).where(and(eq(tickets.id, id),
ne(tickets.status, DONE))).returning()`을 실행한다. 반환 행이 있으면 방금 완료된 티켓이다.
반환 행이 없으면 `id`로 한 번 조회해 ① 행이 없으면 `null`(→ 404), ② 행이 있으면(이미 DONE)
변경 없이 그대로 반환한다.

**Rationale**:
- spec FR-008: 이미 DONE이면 `completedAt`·`position`·`updatedAt`을 바꾸지 않아야 한다. 가드를
  UPDATE 조건에 넣으면 "이미 DONE" 판정과 갱신이 한 문장에서 원자적으로 일어난다. 사전 SELECT 후
  UPDATE 하는 방식은 두 요청이 동시에 들어오면 둘 다 "아직 DONE 아님"으로 읽어 두 번째 요청이
  `completedAt`/`position`을 덮어쓸 수 있다(spec 엣지 케이스 "동시에 완료 처리").
- 정상 경로는 UPDATE 1회(+ 위치 조회 1회)다. 조회 폴백은 멱등·404 경로에서만 실행된다.

**Alternatives considered**:
- 사전 `getTicketById` 후 분기: 왕복이 늘고 위의 경합이 생겨 기각.
- 트랜잭션 + `SELECT ... FOR UPDATE`: 정합성은 가장 강하지만 단일 사용자 MVP에 비해 과하고
  Drizzle 트랜잭션 사용 패턴이 코드베이스에 아직 없어 기각.

## Decision: Done 칼럼의 "최솟값"은 `status = 'DONE'`인 모든 행에서 구한다

**Decision**: 새 `position`은 `status = 'DONE'`인 행의 `position` 최솟값 - 1024, 행이 없으면
1024다. 24시간이 지나 보드에서 숨겨진 DONE 행도 최솟값 계산에 포함한다.

**Rationale**:
- DATA_MODEL.md §5.5와 API_SPEC.md §5는 "DONE 칼럼 내 최솟값"이라고만 적는다. 목록 조회의 24시간
  필터는 조회 시점 필터일 뿐 행이 DONE 상태로 남아 있으므로(DATA_MODEL.md §5.4), 전체 DONE
  행 기준이 "칼럼 내"의 가장 단순한 해석이다.
- 숨겨진 행을 제외하면 그 행과 `position`이 겹칠 수 있고, 24시간 안에 다시 보이지는 않지만
  값의 단조성(새로 완료할수록 더 작아짐)이 깨진다. 전체 기준이면 항상 단조 감소한다.
- 기존 `getNextBacklogPosition`도 백로그 전체 행을 기준으로 한다(확인: `ticketService.ts` 36-48행).

**Alternatives considered**: 보이는(24시간 이내) 행만 기준 — 위의 단조성 문제로 기각.

## Decision: `getNextBacklogPosition`을 `getNextTopPosition(status)`로 일반화한다

**Decision**: 상태를 인자로 받는 내부 헬퍼 `getNextTopPosition(status)`를 추출하고,
`getNextBacklogPosition()`은 `getNextTopPosition(TICKET_STATUS.BACKLOG)`를 호출하는 래퍼로
유지한다(export 시그니처 불변). `completeTicket`은 `getNextTopPosition(TICKET_STATUS.DONE)`을
사용한다.

**Rationale**:
- 확인 결과 `getNextBacklogPosition`의 로직(해당 상태의 최소 `position` 조회, 없으면 1024,
  있으면 최솟값 - 1024)이 완료 처리의 위치 규칙과 상태만 다르고 동일하다. DATA_MODEL.md §5.5의
  표도 생성과 완료를 같은 규칙("해당 칼럼 최솟값 - 1024")으로 정의한다.
- 새 함수를 복사하지 않고 일반화하면 규칙이 한 곳에만 있다. 래퍼를 유지하므로 `001`의 호출부와
  테스트를 건드리지 않는다.

**Alternatives considered**:
- `getNextDonePosition`을 복사해 추가: 중복이 생겨 기각.
- `getNextBacklogPosition` 이름·시그니처 변경: 기존 테스트/호출부 수정이 필요해 이번 범위를
  넘으므로 기각.

## Decision: `completedAt`과 `updatedAt`은 같은 JS `Date` 값을 서비스에서 명시적으로 넣는다

**Decision**: 서비스 함수 안에서 `const now = new Date()`를 만들어 `completedAt: now`,
`updatedAt: now`로 SET한다. DB의 `defaultNow()`/`now()`는 사용하지 않는다.

**Rationale**:
- 목록 조회의 Done 24시간 필터(`getBoardData`)는 `row.completedAt < new Date(Date.now() -
  24h)`처럼 JS 시각과 비교한다(확인: `ticketService.ts` 127-137행). `completedAt`을 JS
  `Date`로 써야 이 비교와 같은 기준이 유지된다.
- 프로젝트 메모리에 기록된 미해결 이슈: `created_at`은 DB `defaultNow()`(DB 세션 시간대의 로컬
  시각), `updated_at`은 JS `new Date()`(UTC)로 채워져 기준이 다르다. 이번 기능이 `completedAt`
  을 DB 시각으로 쓰면 이 혼용이 24시간 필터 경계까지 번질 수 있으므로, `updatedAt`과 같은 JS
  기준으로 통일한다. 두 값이 같은 `now`를 쓰면 `completedAt == updatedAt`이 보장된다.
- 이 이슈 자체(스키마를 `timestamptz`로 바꾸는 등)는 마이그레이션이 필요해 이번 기능 범위 밖이다.

**미검증**: `timestamp without time zone` 컬럼에 JS `Date`를 쓰고 읽을 때의 왕복 일관성은
`TC-API-002-04/05`(기존 통과 중인 테스트)가 간접적으로 보장하지만, 이번 기능의 테스트에서도
"완료 직후 `GET /api/tickets`의 DONE 배열에 포함된다"를 확인해 재검증한다.

**Alternatives considered**: SQL `now()` 사용 — 위의 시간 기준 혼용 때문에 기각.

## Decision: 요청 본문은 읽지 않는다

**Decision**: Route Handler는 `request.json()`을 호출하지 않는다. 시그니처의 첫 인자는 `_request`로
두고, 본문이 있든 없든, 형식이 깨졌든 상관없이 동일하게 처리한다.

**Rationale**:
- spec FR-007: 이 기능은 본문을 사용하지 않는다. 본문을 읽지 않으면 잘못된 JSON 때문에 400이
  나거나 파싱 예외가 나는 경우 자체가 사라진다(`PATCH /api/tickets/:id`와 달리 본문 검증 단계가
  없다).
- Constitution 원칙 IV는 "모든 API 요청(body, query, params)을 Zod로 검증"하라고 하지만, 본문이
  명세상 없는 API이므로 검증 대상은 `params`뿐이다. 본문을 받아 무시하는 것을 검증 누락으로
  보지 않는다(`GET` 핸들러도 같은 이유로 본문을 다루지 않는다).

**Alternatives considered**: 본문이 오면 400으로 거부 — 클라이언트가 실수로 빈 JSON을 보내는 경우
불필요한 실패를 만들고 API_SPEC.md §5("Body: 없음")가 거부를 요구하지 않아 기각.

## Decision: 검증 순서는 id → 서비스(404/멱등)

**Decision**: ① `id` 검증 실패 → 400 `INVALID_ID`, ② 서비스에서 대상 없음 → 404
`TICKET_NOT_FOUND`(문구: "존재하지 않거나 삭제된 티켓입니다"), ③ 성공 또는 이미 DONE → 200,
④ 서비스 예외 → 500 `INTERNAL_ERROR`.

**Rationale**: Constitution 원칙 IV(검증되지 않은 입력은 서비스에 도달하지 않음). 본문 단계가
없으므로 `GET /api/tickets/:id`와 같은 구조다. 404 문구는 003·004와 통일하기로 결정되어
API_SPEC §5, TC-API-005-06, REQUIREMENTS FR-005에 반영되어 있다.

## 문서 정리 항목 (사용자 확인 후 2026-09-29 API_SPEC.md §5에 반영 완료)

Constitution 원칙 II("코드보다 `docs/API_SPEC.md`를 먼저 수정")와 CLAUDE.md("API 응답 형식
변경 → API_SPEC.md 먼저 수정")에 따라, 아래 1건을 구현 전에 API_SPEC.md §5에 반영했다.

1. **500 응답 행 없음** — API_SPEC.md §5의 Response에는 200/400/404만 있고 500이 없었다.
   spec FR-011은 내부 오류 시 일반 오류 안내를 요구한다. 구현된 `GET /api/tickets/:id`,
   `PATCH /api/tickets/:id`는 500을 엔드포인트별 문구로 반환하는 관례를 따른다. → §5에
   `500 INTERNAL_ERROR`와 문구 `티켓을 완료 처리하지 못했습니다`를 추가했다.

## 알려진 한계 (이번 범위에서 고치지 않음)

- **서로 다른 티켓의 동시 완료**: 두 요청이 거의 동시에 Done 칼럼의 최솟값을 읽으면 같은
  `position`이 부여될 수 있다. `position`에는 유니크 제약이 없고, 이는 `createTicket`의
  `getNextBacklogPosition`과 동일한 기존 한계다. 단일 사용자 MVP이므로 수용하고, 동시 요청
  대응이 필요해지면 트랜잭션·잠금을 별도 작업으로 다룬다.
- **`created_at`/`updated_at` 시간 기준 불일치**: 위 `completedAt` 결정으로 이번 기능이 이 혼용을
  넓히지는 않지만, 기존 불일치 자체는 그대로 남는다(메모리 기록 이슈, 마이그레이션 필요).

## 기타 — 확인만 하고 별도 결정이 필요 없던 항목

- **DB 스키마**: `status`(varchar), `position`(integer), `completedAt`/`updatedAt`(timestamp),
  `idx_tickets_status_position` 인덱스 모두 이미 있음. 마이그레이션 불필요
  (`src/server/db/schema.ts` 확인).
- **`isOverdue`**: 기존 `calculateIsOverdue(status, dueDate)`가 `status === DONE`이면 `false`를
  반환한다. 완료 후 행을 `toTicketWithMeta`에 넘기면 종료예정일이 지난 티켓도 `false`가 된다
  (TC-API-008-09).
- **`startedAt`**: SET에 포함하지 않는다. 백로그에서 바로 완료해도 `null`로 남는다(DATA_MODEL.md
  §5.1).
- **응답 형식**: `TicketWithMeta` 단건. `plannedStartDate`/`dueDate`는 `toTicketWithMeta`가
  `YYYY-MM-DD` 문자열로 변환한다.
- **테스트의 시각 비교**: 완료 직후 `completedAt`/`updatedAt`은 "요청 전후 시각 사이"인지로
  검증하고, 멱등 테스트는 과거 `completedAt`/`updatedAt`으로 삽입한 DONE 행이 요청 뒤에도 같은
  값인지로 검증한다(짧은 대기에 의존하지 않도록).
- **프론트엔드**: `src/client/api/ticketApi.ts`와 드래그앤드롭 연동은 이번 범위 밖(경계 규칙).
