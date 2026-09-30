# Research: 티켓 수정 API

Technical Context에 `NEEDS CLARIFICATION`은 없었다. 구현 방식 선택이 필요했던 지점과, 문서/코드
사이에서 발견한 불일치를 정리한다. 아래 "확인 결과"는 실제 코드와 문서를 열어 본 사실이고,
"미검증" 표시는 구현 단계 테스트로 확인해야 하는 항목이다.

## Decision: 수정 스키마는 `createTicketSchema.partial()`이 아니라 별도로 정의한다

**Decision**: `src/shared/validations/ticket.ts`에 `updateTicketSchema`를 독립적으로 추가한다.
모든 필드는 optional이고, `.default()`를 쓰지 않으며, `description`/`plannedStartDate`/
`dueDate`는 `null`을 허용한다. `title`/`priority`는 `null`을 허용하지 않는다.

**Rationale**:
- 기존 `createTicketSchema`의 `priority`에는 `.default(MEDIUM)`이 걸려 있다. `.partial()`을
  써도 이 기본값은 남아 있어, `priority`를 보내지 않은 PATCH가 우선순위를 `MEDIUM`으로
  덮어쓴다(spec FR-002 위반, 데이터 손실).
- 생성 스키마의 `description`은 `.optional()`뿐이라 `null`을 받지 못한다. 수정에서는
  TC-API-004-03/04에 따라 `null`로 비우는 것이 정상 동작이다.
- `dueDate`의 "오늘 이후" 검증은 값이 있을 때만 적용해야 한다(spec FR-009). 생성 스키마의
  `refine`은 `undefined`만 통과시키고 `null`은 다루지 않으므로 그대로 재사용할 수 없다.
- 검증 메시지 문구와 한도(200자, 1000자, 우선순위 3종)는 생성과 같아야 하므로 문구를 그대로
  맞춘다. `isTodayOrAfter` 헬퍼는 같은 파일에 있으므로 재사용한다.

**Alternatives considered**:
- `createTicketSchema.partial()` / `.extend()`: 위의 `.default()`와 `null` 문제로 기각.
- 생성/수정 공통 필드 스키마를 추출하는 리팩터링: 중복은 줄지만 이미 통과 중인 `001` 스키마와
  테스트를 건드리게 된다. 이번 기능 범위를 넘으므로 기각(필요하면 별도 리팩터링 작업).

## Decision: 필요한 필드만 SET 하고 `updatedAt`은 서비스가 명시적으로 세팅한다

**Decision**: `updateTicket`은 입력 객체에서 `undefined`가 아닌 키만 골라 UPDATE의 SET 절을
구성하고, 항상 `updatedAt: new Date()`를 함께 넣는다.

**Rationale**:
- `undefined`인 필드는 "변경 없음", `null`은 "비우기"로 구분해야 한다. 키 존재 여부(`!==
  undefined`)로 구분하면 이 의미가 정확히 표현된다.
- 빈 body(`{}`, TC-API-004-05)도 성공이며 `updatedAt`은 갱신되어야 한다(spec FR-003). SET할
  값이 하나도 없는 Drizzle `update().set({})`은 오류가 날 가능성이 있고(**미검증** —
  Drizzle 동작은 구현 단계 테스트 TC-API-004-05로 확인), 그렇지 않더라도 `$onUpdate`가 값이
  없는 SET에서 동작한다고 가정하면 안 된다. `updatedAt`을 항상 명시하면 이 위험 자체가
  사라진다.
- 서로 다른 필드를 다른 요청이 수정해도 각자 자기 컬럼만 SET 하므로 서로 덮어쓰지 않는다
  (TC-INT-004-02, "겹치지 않는 필드는 두 저장 내용이 모두 남는다").

**Alternatives considered**:
- 사전 SELECT 후 병합해서 전체 행을 UPDATE: 왕복이 2번이고, 동시 수정 시 다른 요청이 바꾼
  필드를 오래된 값으로 되돌릴 수 있어 기각.
- `$onUpdate`에만 의존: 빈 SET 케이스가 불확실해 기각.

## Decision: 존재 확인과 수정을 `UPDATE ... RETURNING` 한 번으로 처리한다

**Decision**: `db.update(tickets).set(...).where(eq(tickets.id, id)).returning()`을 호출하고,
반환 행이 없으면 `null`을 돌려주어 Route Handler가 404로 변환한다.

**Rationale**:
- 조회와 수정 사이에 다른 요청이 행을 삭제하는 경합이 없고 쿼리가 1회다(NFR-001).
- 반환된 행을 기존 `toTicketWithMeta`에 넘기면 수정된 `dueDate` 기준으로 `isOverdue`가
  재계산된다(spec FR-005). 새 변환 로직이 필요 없다.
- `status`/`completedAt`/`position`/`startedAt`은 SET에 포함하지 않으므로 DONE 티켓을 수정해도
  완료 정보는 유지된다.

**Alternatives considered**: 사전 `getTicketById`로 존재 확인 후 UPDATE — 왕복 2회와 경합
가능성 때문에 기각.

## Decision: `status`/`position`은 Zod가 알 수 없는 키로 제거(무시)하게 한다

**Decision**: `updateTicketSchema`를 기본 `z.object`(unknown key strip)로 정의한다. 요청에
`status`, `position` 등이 있어도 파싱 결과에서 제거되고, 서비스에는 도달하지 않는다.

**Rationale**:
- TC-API-004-12는 "무시 또는 거부" 둘 다 허용하고, 결과(상태·순서 불변)는 같다. spec의
  Assumptions와 동일하게 "무시"를 택한다.
- 오류로 거절하면 이후 클라이언트가 수정 화면에서 전체 티켓 객체를 그대로 보낼 때 불필요한
  400이 생긴다.
- 서비스 레이어가 받는 입력 타입(`UpdateTicketInput`)에 애초에 `status`/`position`이 없으므로
  구조적으로도 변경이 불가능하다.

**Alternatives considered**: `.strict()`로 거부 — 명세가 강제하지 않고 클라이언트 편의만
떨어져 기각.

## Decision: 본문 JSON 파싱 실패는 400 `VALIDATION_ERROR`로 처리한다

**Decision**: PATCH 핸들러에서 `request.json()`을 try/catch로 감싸 파싱에 실패하면 400
`VALIDATION_ERROR`(`field` 없음)를 반환한다. 본문이 JSON이지만 객체가 아닌 경우(`[]`,
`"x"`, `null`)도 Zod 검증 실패로 같은 400이 된다(`issue.path`가 비어 `field` 생략).

**Rationale**:
- spec FR-014. 확인 결과 기존 `POST /api/tickets`는 `await request.json()`을 try 밖에서
  호출해, 잘못된 JSON이 들어오면 처리되지 않은 예외로 500이 될 수 있다(확인: `app/api/tickets/
  route.ts` 18행). PATCH에서는 같은 문제를 반복하지 않는다.
- Zod의 기본 오류 메시지는 영어라서, 경로가 없는 실패(본문 전체가 잘못됨)에는 고정 한글
  메시지를 사용한다.

**범위 밖으로 남기는 것**: `POST`의 같은 결함은 이 기능에서 고치지 않는다(명세에 없는 변경,
`001` 범위). 후속 작업 후보로만 기록한다.

**Alternatives considered**: 파싱 실패를 500으로 방치 — 사용자 입력 오류를 서버 오류로
오인시켜 spec FR-014와 충돌하므로 기각.

## Decision: 검증 순서는 id → 본문 → 서비스(404)

**Decision**: ① `id` 검증 실패 → 400 `INVALID_ID`, ② 본문 파싱/검증 실패 → 400
`VALIDATION_ERROR`, ③ 서비스에서 행이 없으면 404, ④ 성공 200. 500은 서비스 예외.

**Rationale**: Constitution 원칙 IV(검증되지 않은 입력은 서비스에 도달하지 않음). 존재하지 않는
id에 잘못된 본문을 보내면 404가 아니라 400이 되는데, 이는 DB 조회 전에 요청 자체의 형식을
먼저 걸러내는 일반적인 순서다.

## 문서 정리 항목 (사용자 확인 후 2026-09-29 API_SPEC.md §4에 반영 완료)

Constitution 원칙 II("코드보다 `docs/API_SPEC.md`를 먼저 수정")와 CLAUDE.md("API 응답 형식
변경 → API_SPEC.md 먼저 수정")에 따라, 아래 2건은 구현 전에 API_SPEC.md §4에 반영해야 한다.
이 plan 단계에서는 문서를 수정하지 않았다.

1. **`plannedStartDate`/`dueDate`의 `null` 허용** — API_SPEC.md §4 Body 표는 `description`만
   `string | null`로 적고 두 날짜 필드는 `ISO 8601 date`로만 적는다. 그러나
   `TEST_CASES.md` TC-API-004-04는 `plannedStartDate: null`을 200으로 기대하고,
   `src/shared/types/index.ts`의 `UpdateTicketInput`은 이미 `plannedStartDate?: string | null`,
   `dueDate?: string | null`이다. `dueDate`의 `null`은 어느 문서에도 명시가 없으나 타입이
   허용하므로 spec의 가정(비울 수 있음)과 일치한다. → API_SPEC.md §4의 두 날짜 필드에
   `| null`을 추가.
2. **본문이 JSON이 아닐 때의 400** — API_SPEC.md §4의 400 표에 이 행이 없다. spec FR-014를
   구현하려면 `VALIDATION_ERROR`(field 없음)와 메시지를 명세에 추가해야 한다. 메시지는
   `요청 본문이 올바른 JSON 형식이 아닙니다`를 제안한다. 이 행을 명세에 넣지 않기로 하면
   spec FR-014를 삭제해야 한다(둘 중 하나로 결정 필요).

또한 `REQUIREMENTS.md` FR-004는 `plannedStartDate`를 "ISO 8601 날짜/시간"이라 적지만 API_SPEC.md
와 기존 생성 구현은 날짜(YYYY-MM-DD)다. 구현은 날짜 형식을 따르며(spec Assumptions), 문서
표현 차이는 이 기능의 결정 사항이 아니므로 참고로만 남긴다.

## 기타 — 확인만 하고 별도 결정이 필요 없던 항목

- **DB 스키마**: `plannedStartDate`/`dueDate`는 `date` 컬럼(`mode: "date"`), `updatedAt`은
  `$onUpdate`가 있는 timestamp. 마이그레이션 불필요(`src/server/db/schema.ts` 확인).
- **날짜 변환**: 문자열 `YYYY-MM-DD`를 `new Date(...)`로 변환해 저장하는 방식은 `createTicket`
  과 동일하게 따른다. 응답 시 `toTicketWithMeta`가 다시 `YYYY-MM-DD` 문자열로 되돌린다.
- **`isOverdue`**: 기존 `calculateIsOverdue(status, dueDate)`를 재사용. 수정 후 행 기준이므로
  `dueDate`를 비우면 `false`가 된다.
- **테스트의 `updatedAt` 비교**: 생성 직후 수정하면 시각 차이가 매우 작을 수 있다. 테스트는
  행을 과거 `updatedAt`으로 직접 삽입하거나 짧게 대기한 뒤 비교해야 안정적이다(구현 단계에서
  tasks에 반영).
- **프론트엔드**: `src/client/api/ticketApi.ts`와 수정 모달은 이번 범위 밖(경계 규칙).
