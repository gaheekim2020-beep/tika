# Research: 티켓 상세 조회 API

Technical Context에 `NEEDS CLARIFICATION`이 없어 대부분 결정이 자명했다. 구현 방식
선택이 필요했던 지점만 정리한다.

## Decision: 목록 조회의 DONE 24시간 필터를 상세 조회에는 적용하지 않는다

**Decision**: `getTicketById(id)`는 `002-list-tickets-api`의 `getBoardData()`와 달리
`completedAt` 기준 24시간 필터를 적용하지 않는다. ID로 존재가 확인되는 한(하드 삭제되지
않은 한) `DONE` 상태이고 완료된 지 오래된 티켓도 그대로 반환한다.

**Rationale**:
- API_SPEC.md §0(공통 규칙 요약)과 §3(`GET /api/tickets/:id`) 모두, 24시간 필터는
  "목록 조회 시점 필터링"이라고 명시하며 상세 조회는 별도 규칙을 두지 않는다
  (`docs/DATA_MODEL.md`: "24시간이 지나 보드에서 사라진 DONE 티켓도
  `GET /api/tickets/:id`(FR-003)로 단건 조회하면 여전히 확인 가능하다").
- `TEST_CASES.md` TC-API-003-02가 이 동작을 명시적으로 요구한다.
- 두 조회 함수(`getBoardData`, `getTicketById`)가 서로 다른 가시성 규칙을 갖는 것은
  "목록 = 현재 보드 뷰", "상세 = 레코드 원본 확인"이라는 서로 다른 사용 목적에서
  자연스럽다.

**Alternatives considered**:
- `getTicketById`에도 동일한 24시간 필터를 적용: 명세(API_SPEC.md, TEST_CASES.md
  TC-API-003-02)와 정면으로 배치되어 기각.

## Decision: id 검증은 Zod `coerce`로 Route Handler 진입 시점에 수행

**Decision**: 경로 파라미터 `id`(항상 문자열)를 `z.coerce.number().int().positive()`로
검증한다. 검증 실패 시 서비스 레이어를 호출하지 않고 즉시 400 `INVALID_ID`를 반환한다.

**Rationale**:
- Constitution 원칙 IV(Zod 기반 요청 검증)에 따라 검증되지 않은 입력이 서비스 레이어에
  도달해서는 안 된다.
- Next.js 동적 라우트의 경로 파라미터는 항상 `string` 타입이므로, 숫자로 변환 가능한지와
  양의 정수인지를 한 번에 검사하는 `coerce` 방식이 별도의 수동 파싱보다 간결하다.
- API_SPEC.md §3의 "ID가 정수가 아니거나 양의 정수가 아니면 400"을 스키마 하나로 정확히
  표현할 수 있다.

**Alternatives considered**:
- 서비스 레이어에서 `Number.isInteger` 등으로 직접 검증: Constitution 원칙 IV(검증은
  `src/shared/validations`에서, 서비스는 검증된 입력만 다룸) 위반이라 기각.

## 기타 — 확인만 하고 별도 결정이 필요 없던 항목

- **DB 조회 방식**: `id`는 `tickets` 테이블의 기본키(PK)이므로 `WHERE id = ?` 조회는
  이미 PK 인덱스로 최적화되어 있다 — 추가 인덱스나 마이그레이션 불필요.
- **`isOverdue` 계산 로직 재사용**: 기존 `calculateIsOverdue(status, dueDate)`와
  `toTicketWithMeta(row)` 헬퍼(`ticketService.ts`, `001`/`002`에서 이미 구현됨)를 그대로
  재사용한다 — 새 변환 로직을 만들지 않는다.
- **소프트 삭제**: `tickets` 테이블에 `deletedAt` 등 소프트 삭제 컬럼이 아직 없다
  (`src/server/db/schema.ts` 확인 완료). 따라서 "삭제된 티켓"과 "존재하지 않는 ID"는
  현재 구현에서 자연히 동일하게 취급된다(행이 없으면 404) — spec.md Assumptions와 일치.
