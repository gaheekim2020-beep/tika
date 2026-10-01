# Implementation Plan: 티켓 상태/순서 변경 API (드래그앤드롭)

**Branch**: `007-reorder-ticket-api` (git 브랜치: `feature/reorder-ticket`) | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-reorder-ticket-api/spec.md`

## Summary

`PATCH /api/tickets/reorder` 엔드포인트를 구현한다. 요청 본문 `{ ticketId, status, position }`으로
티켓 하나의 칼럼(`BACKLOG`/`TODO`/`IN_PROGRESS`)과 칼럼 내 순서값을 한 번에 바꾸고, 성공 시
`GET /api/tickets`와 같은 형식의 보드 전체(4개 칼럼)를 `200`으로 반환한다. `DONE`과 그 밖의
`status`는 `400 VALIDATION_ERROR`, 없는 `ticketId`는 `404 TICKET_NOT_FOUND`(문구: "존재하지 않거나
삭제된 티켓입니다")다.

`position`은 **클라이언트가 규칙(FR-004)대로 계산한 최종 순서값**이며 서버는 그대로 저장한다
(spec FR-005, 옵션 A). 대상 칼럼의 다른 티켓과 값이 겹칠 때만 그 칼럼을 1024 간격으로 재정렬하고,
이때 이동한 티켓을 겹친 티켓보다 앞에 놓는다. 시작 시각(`startedAt`)·완료 시각(`completedAt`)은
이동 방향에 따라 서버가 처리한다.

기술 접근은 `001~006`과 동일한 3계층 분리를 따른다.
- `src/shared/validations/ticket.ts`에 `reorderTicketSchema`를 추가한다. 타입 `ReorderTicketInput`·
  `ReorderableStatus`는 `src/shared/types`에 이미 있다.
- `src/server/services/ticketService.ts`에 `reorderTicket(input): Promise<BoardData | null>`을 추가한다.
  하나의 DB 트랜잭션 안에서 대상 티켓 조회(행 잠금) → 필드 계산 → 충돌 시 재정렬 → 갱신을 수행하고,
  커밋 후 `getBoardData()`로 보드를 만들어 반환한다. 티켓이 없으면 `null`.
- 새 디렉터리 `app/api/tickets/reorder/route.ts`에 `PATCH` 핸들러를 만든다. `/api/tickets/:id`의
  동적 세그먼트와 같은 깊이에 있는 정적 세그먼트다(research.md "경로 충돌" 참조).
- DB 마이그레이션은 없다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버(`db.transaction`, `select().for("update")`
사용), Zod 4(본문 검증), Next.js Route Handler

**Storage**: PostgreSQL — `tickets` 테이블(`src/server/db/schema.ts`)은 이미 구현됨. `position`은
`INTEGER`, `idx_tickets_status_position` 인덱스가 칼럼별 정렬 조회를 지원한다. 마이그레이션 없음.

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`, `--runInBand`),
`__tests__/services/`, `__tests__/api/`. 공유 DB(`tika_test`) 사용. 파일 끝의 최상위
`afterAll(() => db.$client.end())`는 이미 있으므로 유지한다.

**Target Platform**: Vercel (Node.js 서버리스 함수) — 현재는 로컬 개발 단계

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client`는 이번 범위 밖)

**Performance Goals**: NFR-001 — API 응답 300ms 이내(p95). 정상 경로는 조회 2회 + 갱신 1회 + 보드 조회
1회이고, 충돌 시에만 칼럼 크기만큼 갱신이 늘어난다. 로컬 측정값을 NFR 충족 근거로 삼지 않는다
(`002~006`과 동일한 주의).

**Constraints**: `docs/API_SPEC.md` §7의 요청·응답 형식 준수(Constitution 원칙 II). 400/500 응답 행
보완은 승인을 받아 반영했다(research.md "문서 정리 항목"). 서비스는 HTTP를 모르고
`BoardData | null`만 반환한다(원칙 V).

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`PATCH /api/tickets/reorder`). 다건 이동, 이동
이력, 드래그앤드롭 UI·낙관적 업데이트 롤백(프론트엔드)은 범위 밖.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 타입은 `@/shared/types`의 `ReorderTicketInput`·`ReorderableStatus` 재사용, `any` 미사용, 본문은 `unknown`으로 받아 Zod로 검증 | PASS |
| II. API 응답 명세 준수 | 200/400/404/500 응답은 API_SPEC §7 기반. 404 문구는 이미 §7에 반영됨. 400 세부 메시지·500 행은 승인 후 §7에 먼저 반영 완료 | PASS |
| III. 표준 에러 응답 형식 | 모든 에러가 `{ error: { code, message } }`(검증 오류는 선택적으로 `field`) | PASS |
| IV. Zod 기반 요청 검증 | `reorderTicketSchema`를 `src/shared/validations`에 정의하고 Route Handler에서 서비스 호출 전에 검증 | PASS |
| V. 서비스 레이어 분리 | 이동·충돌 재정렬·시각 규칙은 `ticketService.reorderTicket`에 위치. Route Handler는 JSON 파싱→검증→서비스 호출→응답만 수행. DB는 Drizzle만 사용(raw SQL 없음) | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다. 원칙 II의 문서 선행 수정(API_SPEC §7의 400 세부·500
응답 행, 백로그 복귀 시 `startedAt` 규칙)은 사용자 승인을 받아 반영했다.

**Phase 1 설계 후 재검토**: 설계(data-model.md, contracts/reorder-ticket.md) 결과 위 판정이 바뀌지
않았다.

## Project Structure

### Documentation (this feature)

```text
specs/007-reorder-ticket-api/
├── spec.md                    # 완료 (요구사항 명세)
├── plan.md                    # 이 파일
├── research.md                # Phase 0 산출물
├── data-model.md              # Phase 1 산출물
├── quickstart.md              # Phase 1 산출물
├── contracts/
│   └── reorder-ticket.md      # Phase 1 산출물
├── checklists/
│   └── requirements.md        # 완료 (명세 품질 체크리스트)
└── tasks.md                   # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
docs/
├── API_SPEC.md                    # §7 400 세부·500 응답 행 보완 (완료)
└── TEST_CASES.md                  # §2.7에 TC-API-007-15~26 추가 (완료)

src/shared/
├── types/index.ts                 # 변경 없음 — ReorderTicketInput, ReorderableStatus 이미 존재
└── validations/ticket.ts          # reorderTicketSchema 추가

src/server/
└── services/ticketService.ts      # reorderTicket(input) 추가

app/api/tickets/
├── route.ts                       # 변경 없음
├── reorder/route.ts               # 신규 — PATCH 핸들러
└── [id]/                          # 변경 없음

__tests__/
├── services/ticketService.test.ts # reorderTicket() 테스트 추가
└── api/tickets.test.ts            # PATCH /api/tickets/reorder 테스트 추가
                                   # (TEST_CASES.md TC-API-007-01~14 + 추가 케이스)
```

**Structure Decision**: `001~006`과 동일한 3계층 구조(`app/api` ↔ `src/server` ↔ `src/shared`)를
따른다. `reorder`는 `/complete`와 달리 `:id` 아래가 아니라 컬렉션(`/api/tickets`) 바로 아래의 별도
경로이므로 `app/api/tickets/reorder/route.ts`를 새로 만든다. 서비스·테스트는 기존
`ticketService.ts`/`tickets.test.ts`/`ticketService.test.ts`에 추가한다. 프론트엔드(`src/client`)는
경계 규칙상 이번 범위에서 수정하지 않는다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
