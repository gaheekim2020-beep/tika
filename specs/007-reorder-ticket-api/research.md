# Research: 티켓 상태/순서 변경 API

Technical Context에 `NEEDS CLARIFICATION`은 없었다(요청 `position` 해석은 spec 단계에서 옵션 A로
확정). 구현 방식 선택이 필요했던 지점과, 문서/코드 사이에서 발견한 사항을 정리한다.

## Decision: 충돌 판정은 "대상 칼럼의 다른 티켓과 `position` 값이 같은가"다

**Decision**: 이동하는 티켓 자신을 뺀 대상 칼럼 티켓 중 `position`이 요청값과 같은 행이 하나라도
있으면 충돌로 보고 칼럼을 재정렬한다. 없으면 요청값을 그대로 저장한다.

**Rationale**:
- `position` 컬럼은 `INTEGER`다. 정수끼리의 간격이 1 미만이라는 것은 두 값이 같다는 뜻이므로, spec
  FR-005의 "겹치거나 간격이 1 미만"은 "같은 값"과 동치다. 별도의 간격 계산이 필요 없다.
- 자기 자신을 제외하므로 "같은 칼럼의 같은 위치로 이동"(spec 엣지 케이스)은 충돌이 아니라 성공이다.

**Alternatives considered**:
- 인접 카드를 조회해 `(prev+next)/2`를 서버가 계산: 요청에 인접 카드 정보가 없고 옵션 B(기각됨)에
  해당한다.
- 요청값 근처 ±1 범위를 충돌로 간주: 정수 컬럼에서는 의미가 없고 불필요한 재정렬만 늘린다.

## Decision: 재정렬은 "이동 티켓을 겹친 티켓 앞에 끼워 넣은 뒤 1024 간격으로 전부 다시 매긴다"

**Decision**: 충돌 시 순서는 `[position < 요청값인 티켓들] + [이동 티켓] + [position >= 요청값인
티켓들]`이고(각 그룹은 `position`, 같으면 `id` 오름차순), 이 순서대로 `1024, 2048, 3072, …`를 부여한다.
이동 티켓의 `status`/`position`/시각 필드와 값이 바뀐 다른 티켓의 `position`을 같은 트랜잭션에서
갱신한다.

**Rationale**: spec FR-005("값이 겹치면 이동한 할 일이 겹친 기존 할 일보다 앞에 놓인다")를 그대로
구현한다. `id` 보조 정렬은 기존 데이터에 이미 같은 값이 있어도 결과를 결정적으로 만든다. 다른 칼럼은
건드리지 않는다(DATA_MODEL §5.5).

**Alternatives considered**: `position`이 같은 티켓들 뒤에 놓기 — spec에서 앞으로 정했으므로 기각.
단일 `UPDATE ... CASE WHEN` — Drizzle `sql` 템플릿이 필요해 "raw SQL 금지"(CLAUDE.md) 경계에 걸리고,
칼럼 크기가 작아 행별 `update`로 충분해 기각.

**클라이언트 규칙 (한계 해소)**: 클라이언트가 두 카드 사이의 중간값을 `Math.ceil((prev + next) / 2)`로 계산하면 정수 간격이 없을 때(`prev=1024, next=1025`) 올림값이 `next`와 같아져 충돌이 되고, 서버의 "이동 티켓이 겹친 카드 앞" 규칙에 따라 `prev`와 `next` 사이에 정확히 놓인다. 내림하면 `prev`와 같아져 `prev` 앞으로 가므로 한 칸 어긋난다. 따라서 "이동 티켓이 앞" 규칙은 이 올림 규칙과 짝이며, 올림 규칙은 API_SPEC §7에 반영했다. 클라이언트 구현(프론트엔드 작업)에서 COMPONENT_SPEC §3.6에도 반영한다.

## Decision: 하나의 트랜잭션에서 대상 티켓을 `FOR UPDATE`로 잠그고 모든 갱신을 수행한다

**Decision**: `db.transaction(async (tx) => { ... })` 안에서 `tx.select().from(tickets).where(eq(id))
.for("update")`로 티켓을 읽고, 이후의 조회·갱신을 모두 `tx`로 수행한다. 보드 반환용
`getBoardData()`는 커밋 후에 호출한다.

**Rationale**:
- DATA_MODEL §5.5·spec FR-003: 상태와 순서는 항상 함께 반영되어야 하고, 재정렬처럼 갱신이 여러 번
  나뉠 때 중간 실패는 전부 롤백되어야 한다.
- 같은 티켓에 대한 동시 이동 요청이 서로의 `startedAt`/`completedAt` 판단을 덮어쓰지 않도록 행 잠금을
  쓴다. (서로 다른 티켓이 같은 칼럼에 동시에 같은 값으로 들어오는 경합까지 막지는 않는다 — MVP
  단일 사용자 전제, 아래 "범위 밖" 참조.)
- Drizzle 0.45의 `db.transaction`과 `select().for("update")`는 설치된 타입 정의에서 확인했다
  (`pg-core/query-builders/select.d.ts`, `postgres-js/session.d.ts`).
- 정상 경로에서는 `status`와 `position`을 하나의 `UPDATE` 문으로 쓰므로 "status만 반영되고 position은
  실패"하는 중간 상태가 구조적으로 생기지 않는다. 원자성이 실제로 의미를 갖는 곳은 재정렬 경로(여러
  `UPDATE`)이며 테스트도 그 경로에서 실패를 주입한다(아래 "TC-API-007-14 검증 방법").

**Alternatives considered**: 트랜잭션 없이 개별 `UPDATE` — TC-API-007-14와 spec FR-003 위반으로 기각.
`SERIALIZABLE` 격리 수준 — 단일 사용자 MVP에는 과하고 재시도 로직이 필요해 기각.

## Decision: 시각 규칙은 "이동 전 상태"와 "대상 상태"만으로 계산한다

**Decision**: `now = new Date()` 하나를 쓰고(다른 서비스 함수와 같은 JS 시각 기준) 다음과 같이 계산한다.

| 조건 | `startedAt` | `completedAt` |
|------|------|------|
| 대상이 `TODO`/`IN_PROGRESS`이고 기존 `startedAt`이 `null` | `now` | — |
| 대상 `BACKLOG` (출발 칼럼 무관) | `null` | — |
| 그 외 | 변경 없음 | — |
| 이동 전 `DONE` | — | `null` |
| 이동 전 `DONE`이 아님 | — | 변경 없음 |

`updatedAt`은 이동한 티켓에 `now`를 명시하고, 재정렬로 `position`만 바뀌는 다른 티켓에는 스키마의
`$onUpdate`가 적용된다(DATA_MODEL "재정렬 시 updatedAt 자동 갱신").

**Rationale**: spec FR-006/FR-007과 DATA_MODEL §5.1·§5.2를 그대로 옮긴 것이다. 대상이 `DONE`인 경우는
스키마 검증 단계에서 이미 걸러진다.

**확정 사항**: 사용자 확인(2026-10-01)에 따라 "백로그로 오면 항상 비운다"가 의도다. 출발 칼럼이 `TODO`뿐 아니라 `IN_PROGRESS`·`DONE`이어도 `BACKLOG`로 이동하면 `startedAt`을 비운다. 이에 맞춰 spec FR-006, REQUIREMENTS FR-007, DATA_MODEL §5.1, COMPONENT_SPEC, API_SPEC §7을 먼저 고쳤다.

**Alternatives considered**: DB `now()` 사용 — `completeTicket`과 같은 이유(보드의 24시간 필터가 JS
시각 기준)로 기각. (memory의 `createdAt`/`updatedAt` 기준 불일치 문제는 이번 범위에서 다루지 않는다.)

## Decision: Zod 스키마는 `reorderTicketSchema` 하나이며 `status` 오류는 `field`를 생략한다

**Decision**: `src/shared/validations/ticket.ts`에 다음을 추가한다.

| 필드 | 규칙 | 오류 메시지 |
|------|------|------|
| `ticketId` | 양의 정수 | "유효하지 않은 티켓 ID입니다" (`code`는 `VALIDATION_ERROR`, `field="ticketId"`) |
| `status` | `BACKLOG`/`TODO`/`IN_PROGRESS` 중 하나 | "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" |
| `position` | 정수, 32비트 정수 범위 | "위치는 -2147483648 이상 2147483647 이하의 정수로 입력해주세요" (`field="position"`) |

본문이 JSON이 아니거나 객체가 아니면 `PATCH /api/tickets/:id`(004)와 같은 응답 — `code=VALIDATION_ERROR`,
`field` 없음, "요청 본문이 올바른 JSON 형식이 아닙니다"를 반환한다. 정의되지 않은 키는 제거한다(004와
동일).

`status` 검증 실패 응답에서는 `error.field`를 **생략**한다. API_SPEC §7의 400 예시와 TC-API-COMMON-03
("`status` 같은 필드 무관 오류에는 `field` 없음")이 그렇게 정의하기 때문이다. 나머지 필드 오류에는
`field`를 포함한다(COMMON-02).

**Rationale**: Constitution 원칙 IV. `position`을 정수로 제한하는 이유는 DB 컬럼이 `INTEGER`이기
때문이다(소수·범위 초과 값이 DB 오류로 500이 되는 것을 400으로 앞당겨 막는다). 클라이언트의 중간값
계산이 소수가 되면 클라이언트가 올림한 정수로 보낸다(위 "클라이언트 규칙").

**Alternatives considered**: `ticketId` 오류에 `INVALID_ID` 코드 사용 — 경로 파라미터가 아니라 본문
필드이므로 API_SPEC §7의 400 `VALIDATION_ERROR` 범주에 두는 것이 명세와 일치해 기각. 본문 오류 헬퍼를
공용 모듈로 추출 — 004 라우트를 건드리는 리팩터링이라 이번 범위에서 제외하고 `reorder/route.ts`에
같은 형태로 둔다(중복 제거는 후속 정리 항목).

## Decision: 새 디렉터리 `app/api/tickets/reorder/route.ts`에 핸들러를 둔다

**Decision**: `PATCH`만 export하는 `app/api/tickets/reorder/route.ts`를 만든다.

**Rationale**: `/api/tickets/reorder`는 `/api/tickets/[id]`와 같은 깊이의 정적 세그먼트다. 정적 세그먼트가
동적 세그먼트보다 우선한다는 것이 일반적인 App Router 동작이지만, Next.js 16 공식 문서(Route Handlers,
Dynamic Route Segments)에서 이 우선순위를 명시한 문장을 **확인하지 못했다**. 핸들러를 직접 호출하는
Jest 테스트는 라우팅을 거치지 않으므로 이 점을 검증하지 못한다. 따라서 구현 후 quickstart의
`curl` 시나리오로 `/api/tickets/reorder`가 `[id]/route.ts`의 `PATCH`(`id="reorder"` → 400 `INVALID_ID`)
가 아니라 새 핸들러로 가는지 반드시 확인한다.

**Alternatives considered**: `[id]/route.ts`의 `PATCH`에서 `id === "reorder"`를 분기 — Route Handler를
얇게 유지한다는 원칙(V)과 004의 책임을 흐려 기각. 경로를 `/api/tickets/reorder` 대신 `/:id/reorder`로
변경 — API_SPEC §7과 COMPONENT_SPEC의 계약 변경이라 기각.

## TC-API-007-14 검증 방법 (원자성 테스트)

TEST_CASES의 "status UPDATE는 성공, 이어지는 position UPDATE에서 실패"는 정상 경로가 단일 `UPDATE`라
그대로 재현할 수 없다. 대신 **재정렬 경로**(이동 티켓 갱신 후 다른 티켓 갱신이 여러 번 일어나는 경로)에서
`db.transaction`의 콜백에 넘겨지는 `tx`의 `update`가 N번째 호출에서 예외를 던지도록 `jest.spyOn`으로
감싼 뒤, 호출 후 DB의 모든 티켓이 이동 전 값 그대로인지(`status`, `position`, `startedAt`,
`completedAt`)와 서비스가 예외를 던지는지를 확인한다. 이 방식이 `db.transaction`을 가로채기 어려우면
구현 단계에서 `tasks.md`에 대안(예: 유니크 제약 위반 유도)을 기록한다.

## 문서 정리 항목 (Constitution 원칙 II — 2026-10-01 승인, 반영 완료)

1. **API_SPEC.md §7 — 400 응답 보완**: 현재 `status` 오류 예시 한 개뿐이다. `ticketId`/`position`
   오류와 본문 형식 오류 예시(위 표)를 추가한다.
2. **API_SPEC.md §7 — 500 응답 행 추가**: `{ "error": { "code": "INTERNAL_ERROR", "message": "티켓 순서를
   변경하지 못했습니다" } }` (엔드포인트별 문구를 분리하는 기존 관례).
3. **API_SPEC.md §7 — `position` 설명 보완**: "칼럼 내 새 위치"를 "클라이언트가 계산한 최종 순서값(정수)"
   으로, 값이 겹칠 때의 재정렬 규칙(이동 티켓이 앞)을 처리 규칙에 한 줄 추가한다.
4. **TEST_CASES.md §2.7 — 케이스 추가**: spec에서 파생되었으나 TC가 없는 케이스(아래 contracts 문서의
   "추가 TC 제안" 표)를 TC-API-007-15 이후로 추가한다.

## 범위 밖 (명시)

- 서로 다른 티켓이 같은 칼럼의 같은 `position`으로 동시에 들어오는 경합: 단일 사용자 MVP 전제상
  고려하지 않는다(`FOR UPDATE`는 이동 대상 티켓 행만 잠근다).
- `position` 32비트 범위 근처에서의 재정렬 오버플로: 1024 간격 재정렬 후에는 값이 작아지므로 실제로
  발생하기 어렵고, 범위 초과 요청값은 검증에서 400으로 거부한다.
