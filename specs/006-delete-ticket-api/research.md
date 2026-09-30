# Research: 티켓 삭제 API

Technical Context에 `NEEDS CLARIFICATION`은 없었다. 구현 방식 선택이 필요했던 지점과, 문서/코드
사이에서 발견한 사항을 정리한다.

## Decision: `DELETE ... WHERE id = ? RETURNING id` 한 번으로 존재 확인과 삭제를 처리한다

**Decision**: `deleteTicket(id)`는 `db.delete(tickets).where(eq(tickets.id, id)).returning({ id:
tickets.id })`를 실행하고, 반환 행이 있으면 `true`, 없으면 `false`를 반환한다. Route Handler는
`false`면 404, `true`면 204로 변환한다.

**Rationale**:
- spec FR-007: 존재하지 않거나 이미 삭제된 id는 성공이 아니라 404여야 한다(TC-API-006-05).
  `RETURNING`의 행 유무가 곧 "삭제했는가"이므로 사전 조회가 필요 없다.
- 두 요청이 동시에 같은 id를 삭제해도 DB가 한쪽만 행을 지우므로 한쪽은 `true`, 다른 쪽은 `false`
  (404)가 된다. spec 엣지 케이스 "동시에 삭제"의 기대 동작과 일치한다.
- 쿼리 1회라 사전 SELECT 후 DELETE 하는 방식보다 왕복이 적다.

**Alternatives considered**:
- 사전 `getTicketById` 후 삭제: 왕복이 늘고 동시 요청 시 둘 다 성공 경로로 들어갈 수 있어 기각.
- 삭제된 행 전체를 반환: 응답 본문이 없으므로 불필요해 기각.

## Decision: 서비스는 `boolean`을 반환하고 HTTP 상태는 Route Handler가 정한다

**Decision**: `deleteTicket(id): Promise<boolean>`. `null`/`undefined`가 아닌 `boolean`을 쓴다.

**Rationale**: `getTicketById`·`updateTicket`·`completeTicket`은 "없으면 `null`"을 반환하지만, 삭제는
반환할 엔티티가 없다. 성공/실패를 나타내는 값이 `boolean`으로 가장 명확하고, 서비스는 HTTP 상태
코드를 모른다(Constitution 원칙 V).

**Alternatives considered**: 삭제된 `TicketWithMeta` 반환 — 204는 본문이 없고 호출부에서 쓰지 않아
기각.

## Decision: `DELETE` 핸들러는 기존 `[id]/route.ts`에 추가한다

**Decision**: `app/api/tickets/[id]/route.ts`에 `export async function DELETE`를 추가한다.

**Rationale**: App Router는 경로 세그먼트마다 `route.ts`를 두고 HTTP 메서드별로 함수를 export한다.
`/api/tickets/:id`는 이미 `GET`, `PATCH`가 있으므로 같은 파일에 `DELETE`를 두는 것이 자연스럽다.
`/complete`는 경로 세그먼트가 달라 별도 디렉터리였지만 이번에는 해당 없다.

**Alternatives considered**: 별도 파일 — Next.js가 같은 경로에 `route.ts`를 둘 이상 허용하지
않아 불가능.

## Decision: 204는 본문 없는 `Response`로 반환한다

**Decision**: 성공 시 `new Response(null, { status: 204 })`를 반환한다.

**Rationale**: 204는 본문을 가질 수 없다. `NextResponse.json(null, { status: 204 })`는 본문 `"null"`을
실어 보내려 해 HTTP 규격과 어긋나고 환경에 따라 오류가 날 수 있다. 본문 없는 `Response`가
규격에 맞다.

**Alternatives considered**: `NextResponse.json(null, {status: 204})` — 위 이유로 기각.

## Decision: 요청 본문은 읽지 않고, 삭제 후 순서값은 재정렬하지 않는다

**Decision**: Route Handler는 `request.json()`을 호출하지 않는다(시그니처 첫 인자 `_request`).
삭제 후 같은 칼럼의 나머지 티켓 `position`은 건드리지 않는다.

**Rationale**:
- spec FR-006: 본문을 사용하지 않는다. 읽지 않으면 잘못된 JSON으로 인한 오류 경로 자체가 없다
  (`complete`와 동일).
- spec FR-005: `position`은 오름차순 정렬 기준일 뿐 연속일 필요가 없다. DATA_MODEL.md의 위치 계산
  규칙(양 끝 ±1024, 사이 중간값, 간격 < 1 시 재정렬)은 빈 자리가 있어도 성립한다. 재정렬하면
  쿼리와 갱신 범위만 늘어난다.

**Alternatives considered**: 삭제 후 칼럼 재정렬 — 이득이 없고 동시성 위험만 커서 기각.

## Decision: 검증 순서는 id → 서비스(404)

**Decision**: ① `id` 검증 실패 → 400 `INVALID_ID`, ② 서비스가 `false` → 404 `TICKET_NOT_FOUND`
(문구: "존재하지 않거나 삭제된 티켓입니다"), ③ `true` → 204, ④ 서비스 예외 → 500
`INTERNAL_ERROR`.

**Rationale**: Constitution 원칙 IV(검증되지 않은 입력은 서비스에 도달하지 않음). 본문 단계가
없으므로 `GET /api/tickets/:id`와 같은 구조다. 404 문구는 003·004·005와 통일하기로 결정되어
API_SPEC §6, TC-API-006-04, REQUIREMENTS FR-006에 반영되어 있다.

## 문서 정리 항목 (사용자 확인 후 2026-09-30 API_SPEC.md §6에 반영 완료)

Constitution 원칙 II("코드보다 `docs/API_SPEC.md`를 먼저 수정")와 CLAUDE.md("API 응답 형식 변경 →
API_SPEC.md 먼저 수정")에 따라, 아래 1건을 구현 전에 API_SPEC.md §6에 반영했다.

1. **500 응답 행 없음** — API_SPEC.md §6의 Response에는 204/400/404만 있고 500이 없다. spec
   FR-009는 내부 오류 시 일반 오류 안내를 요구한다. 구현된 다른 엔드포인트는 500을 엔드포인트별
   문구로 반환하는 관례를 따른다. → §6에 `500 INTERNAL_ERROR`와 문구 `티켓을 삭제하지 못했습니다`를
   추가했다.

## 알려진 한계 (이번 범위에서 고치지 않음)

- **삭제 후 칼럼 내 순서값의 빈 자리**: 재정렬하지 않으므로 `position` 값이 연속이지 않을 수 있다.
  표시 순서에는 영향이 없다.
- **복구 불가**: Hard Delete이므로 삭제 후 되돌릴 수 없다. 실수 방지는 프론트엔드의 확인
  다이얼로그(`TC-COMP-008`)가 담당한다.

## 기타 — 확인만 하고 별도 결정이 필요 없던 항목

- **DB 스키마**: 다른 테이블의 외래 키가 `tickets`를 참조하지 않는다. 마이그레이션 불필요
  (`src/server/db/schema.ts` 확인).
- **24시간 지난 DONE 티켓**: 보드 목록에서만 숨겨질 뿐 행은 남아 있으므로 동일하게 삭제된다.
- **테스트 보강 필요 케이스**: `docs/TEST_CASES.md` §2.6(TC-API-006-01~05)에 없어 구현 단계에서
  추가가 필요한 케이스(spec 근거): `id`가 0·음수일 때 400, 요청 본문(깨진 JSON 포함)이 있어도
  동일 결과, 삭제 후 다른 티켓 내용·`position` 불변, 삭제 후 `GET /api/tickets` 목록에 없음,
  DONE 등 모든 상태 삭제, 서비스 예외 시 500.
- **프론트엔드**: `src/client/api/ticketApi.ts`와 삭제 UI는 이번 범위 밖(경계 규칙).
