# Research: 티켓 목록 조회 API (보드)

Technical Context에 `NEEDS CLARIFICATION`이 없어 대부분 결정이 자명했다. 유일하게
구현 방식 선택이 필요했던 지점만 정리한다.

## Decision: DONE 24시간 필터는 DB 쿼리(WHERE)가 아니라 애플리케이션 레벨에서 적용

**Decision**: 전체 티켓을 `status`/`position` 기준으로 한 번에 조회한 뒤, `DONE` 상태
티켓만 애플리케이션 코드에서 `completedAt >= (now - 24h)` 조건으로 필터링한다. SQL의
`WHERE`절에 시간 조건을 넣지 않는다.

**Rationale**:
- `isOverdue` 계산도 어차피 조회 시점의 `now`를 기준으로 애플리케이션에서 계산해야 하므로
  (DATA_MODEL.md §5.3, 이미 `calculateIsOverdue` 헬퍼로 구현됨), DONE 필터만 SQL로
  분리하면 "시간 기준 로직이 DB 쿼리와 애플리케이션 코드 두 곳에 나뉘는" 비일관성이 생긴다.
- 티켓 전체 개수가 단일 사용자 MVP 규모(수십~수백 건)라 애플리케이션 레벨 필터링의 성능
  비용이 무시할 수준이다 (NFR-001 300ms 기준에 여유).
- `idx_tickets_status_position` 복합 인덱스로 이미 `status`별 조회가 빠르므로, `DONE`
  상태만 조회한 뒤 필터링해도 별도 인덱스 최적화가 필요 없다.

**Alternatives considered**:
- SQL `WHERE completed_at >= NOW() - INTERVAL '24 hours'`로 DB에서 직접 필터링: 쿼리
  한 번으로 끝나는 장점은 있으나, `isOverdue` 계산과 로직이 이원화되고 `idx_tickets_completed_at`
  인덱스를 시간 범위 조건에 맞게 활용하려면 쿼리가 더 복잡해짐. 규모상 이점이 없어 기각.

## Decision: 컬럼별 그룹화는 애플리케이션 레벨에서 수행

**Decision**: `status`/`position` 정렬된 전체 티켓을 한 번의 쿼리로 가져온 뒤,
`COLUMN_ORDER`(`src/shared/types`에 이미 정의됨) 기준으로 애플리케이션 코드에서
`{ BACKLOG: [], TODO: [], IN_PROGRESS: [], DONE: [] }` 형태로 그룹화한다. 상태별로
4번 쿼리하지 않는다.

**Rationale**: 쿼리 1회로 전체 데이터를 가져와 애플리케이션에서 그룹화하는 것이 왕복
횟수가 적고, `idx_tickets_status_position` 인덱스가 이미 `ORDER BY status, position`에
최적화되어 있어 정렬 비용도 낮다. `BoardData`/`COLUMN_ORDER` 타입이 이미 이 그룹화 형태를
전제로 설계되어 있다 (`src/shared/types/index.ts`).

**Alternatives considered**: 상태별 4회 쿼리 — 왕복 횟수만 늘고 얻는 이점이 없어 기각.

## 기타 — 확인만 하고 별도 결정이 필요 없던 항목

- **Zod 검증**: 이 엔드포인트는 요청 파라미터가 없어(spec.md Assumptions) 검증 스키마
  자체가 불필요. `src/shared/validations/ticket.ts`에 GET용 스키마를 추가하지 않는다.
- **DB 마이그레이션**: 필요한 인덱스(`idx_tickets_status_position`, `idx_tickets_completed_at`)가
  `001-create-ticket-api`에서 이미 생성되어 있어 추가 마이그레이션이 필요 없다.
- **`isOverdue` 계산 로직 재사용**: `ticketService.ts`의 기존 `calculateIsOverdue(status, dueDate)`를
  그대로 재사용한다 — 새 함수를 만들지 않는다.
