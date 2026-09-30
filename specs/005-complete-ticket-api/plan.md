# Implementation Plan: 티켓 완료 처리 API

**Branch**: `005-complete-ticket-api` (git 브랜치: `feature/complete-ticket`) | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-complete-ticket-api/spec.md`

## Summary

사용자가 티켓을 Done 칼럼으로 옮겨 완료 처리하는 `PATCH /api/tickets/:id/complete`
엔드포인트를 구현한다. 요청 본문은 사용하지 않는다. 완료 처리 시 `status = DONE`,
`completedAt`·`updatedAt` = 현재 시각, `position` = Done 칼럼 최솟값 - 1024(칼럼이 비면
1024)로 바꾸고, 응답의 `isOverdue`는 항상 `false`다. 이미 DONE인 티켓에는 오류 없이 200을
반환하되 어떤 값도 바꾸지 않는다(멱등, spec FR-008).

기술 접근은 `001~004`와 동일한 3계층 분리를 따른다.
- `src/server/services/ticketService.ts`에 `completeTicket(id)`를 추가한다. Done 칼럼의 맨 위
  `position`을 계산한 뒤, `UPDATE ... WHERE id = ? AND status <> 'DONE' RETURNING` 한 번으로
  "존재 + 아직 DONE 아님" 조건을 원자적으로 처리한다. 갱신된 행이 없으면 조회로 "없음(null)"과
  "이미 DONE(그대로 반환)"을 구분한다. 기존 `toTicketWithMeta`를 재사용한다.
- 기존 `getNextBacklogPosition`을 상태를 인자로 받는 `getNextTopPosition(status)`로 일반화하고,
  `getNextBacklogPosition`은 이를 호출하는 얇은 래퍼로 남긴다(기존 호출·테스트 변경 없음).
- 새 파일 `app/api/tickets/[id]/complete/route.ts`에 `PATCH` 핸들러를 추가한다. 경로 `id`만
  `ticketIdParamSchema`로 검증하고, 요청 본문은 읽지 않는다.
- 새 Zod 스키마·새 타입·DB 마이그레이션은 없다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버, Zod(경로 파라미터 검증에
기존 `ticketIdParamSchema` 재사용), Next.js Route Handler (`params`는 Promise)

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨.
`status`, `position`, `completedAt`, `updatedAt` 컬럼과 `idx_tickets_status_position`
인덱스가 이미 있어 스키마 변경/마이그레이션이 없다.

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`, `--runInBand`),
`__tests__/services/`, `__tests__/api/`. 공유 DB(`tika_test`) 사용. 파일 끝의 최상위
`afterAll(() => db.$client.end())`는 이미 있으므로 유지한다.

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler) — 현재는 로컬
개발 단계

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client`는 이번 범위 밖)

**Performance Goals**: NFR-001 — API 응답 300ms 이내(p95). 정상 경로는 쿼리 2회
(Done 칼럼 최솟값 조회 + `UPDATE ... RETURNING`)이며 멱등 경로만 3회다. 로컬 측정값을 NFR
충족 근거로 삼지 않는다(`002~004`와 동일한 주의).

**Constraints**: `docs/API_SPEC.md` §5의 요청·응답 형식 준수(Constitution 원칙 II).
`completedAt`은 DB `now()`가 아니라 서비스의 JS `Date`로 기록해야 한다 — 목록 조회의 Done
24시간 필터가 JS 시각과 비교하기 때문이다(research.md, 메모리의 timestamp 불일치 이슈 참조).
API_SPEC.md §5의 500 응답 행은 반영 완료(research.md "문서 정리 항목").

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`PATCH /api/tickets/:id/complete`). 되돌리기
(`reorder`), 수정, 삭제, 프론트엔드 드래그앤드롭 연동은 범위 밖.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 응답은 기존 `TicketWithMeta`, 상태 상수는 `TICKET_STATUS`(`@/shared/types`)를 사용. 새 공유 타입 없음. `any` 미사용, 요청 본문은 읽지 않음 | PASS |
| II. API 응답 명세 준수 | 필드·상태 코드(200/400/404)는 API_SPEC.md §5를 따름. 멱등 처리 규칙, 404 문구, 500 응답 행은 모두 §5에 반영됨 | PASS |
| III. 표준 에러 응답 형식 | 400 `INVALID_ID`, 404 `TICKET_NOT_FOUND`, 500 `INTERNAL_ERROR` 모두 `{ error: { code, message } }` | PASS |
| IV. Zod 기반 요청 검증 | 경로 파라미터는 기존 `ticketIdParamSchema`로 서비스 호출 전에 검증. 본문은 사용하지 않으므로 본문 스키마는 없음(spec FR-007) — 검증되지 않은 입력이 서비스에 도달하지 않음 | PASS |
| V. 서비스 레이어 분리 | 완료 로직(위치 계산, 멱등 판정, 시각 기록)은 `ticketService.completeTicket`에 위치. Route Handler는 id 검증→서비스 호출→응답만 수행. DB는 Drizzle만 사용(raw SQL 없음) | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다. 원칙 II의 문서 선행 수정 1건(500 응답 행)은
사용자 승인 후 API_SPEC.md §5에 반영해 해소했다.

**Phase 1 설계 후 재검토**: 설계(data-model.md, contracts/complete-ticket.md) 결과 위 판정이
바뀌지 않았다.

## Project Structure

### Documentation (this feature)

```text
specs/005-complete-ticket-api/
├── spec.md                    # 완료 (요구사항 명세)
├── plan.md                    # 이 파일
├── research.md                # Phase 0 산출물
├── data-model.md              # Phase 1 산출물
├── quickstart.md              # Phase 1 산출물
├── contracts/
│   └── complete-ticket.md     # Phase 1 산출물
├── checklists/
│   └── requirements.md        # 완료 (명세 품질 체크리스트)
└── tasks.md                   # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
docs/
└── API_SPEC.md                    # §5에 500 응답 행 추가 완료

src/shared/
├── types/index.ts                 # 변경 없음 — TICKET_STATUS, TicketWithMeta 이미 정의됨
└── validations/ticket.ts          # 변경 없음 — ticketIdParamSchema 재사용

src/server/
└── services/ticketService.ts      # getNextTopPosition(status) 추출,
                                   # getNextBacklogPosition은 래퍼로 유지,
                                   # completeTicket(id) 추가

app/api/tickets/[id]/
├── route.ts                       # 변경 없음 (GET, PATCH)
└── complete/
    └── route.ts                   # 신규 — PATCH 핸들러 (id 검증 → 서비스 호출 → 응답)

__tests__/
├── services/ticketService.test.ts # completeTicket() 단위 테스트 추가
└── api/tickets.test.ts            # PATCH /api/tickets/:id/complete 테스트 추가
                                   # (TEST_CASES.md TC-API-005-01~07)
```

**Structure Decision**: `001~004`와 동일한 3계층 구조(`app/api` ↔ `src/server` ↔
`src/shared`)를 따른다. Next.js App Router는 경로 세그먼트마다 `route.ts`를 두므로
`/complete`는 기존 `[id]/route.ts`가 아니라 새 디렉터리 `[id]/complete/route.ts`에 만든다.
서비스는 기존 `ticketService.ts`에 함수를 추가해 리소스별 단일 진실 공급원 원칙을 지킨다.
테스트는 `004`와 같이 기존 `tickets.test.ts`/`ticketService.test.ts`에 추가한다. 프론트엔드
(`src/client`)는 경계 규칙상 이번 범위에서 수정하지 않는다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
