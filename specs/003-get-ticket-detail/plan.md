# Implementation Plan: 티켓 상세 조회 API

**Branch**: `feature/list-tickets-api` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-get-ticket-detail/spec.md`

## Summary

사용자가 특정 티켓의 ID를 지정해 전체 상세 정보를 단건 조회할 수 있는
`GET /api/tickets/:id` 엔드포인트를 구현한다. 조회 시점 기준 `isOverdue`를 계산해 함께
반환하며, 목록 조회(`GET /api/tickets`)에 적용되는 "완료 후 24시간 경과 시 숨김" 규칙은
상세 조회에는 적용하지 않는다. ID가 양의 정수가 아니면 400, 존재하지 않으면 404를
반환한다.

기술 접근은 `001-create-ticket-api`, `002-list-tickets-api`와 동일한 계층 분리를 따른다:
경로 파라미터 `id`를 Zod로 검증하는 스키마를 `src/shared/validations/ticket.ts`에 추가하고,
`src/server/services/ticketService.ts`에 단건 조회 함수를 추가하며(기존 `toTicketWithMeta`
헬퍼 재사용), Next.js 동적 라우트 `app/api/tickets/[id]/route.ts`를 신규 생성해 파싱 →
서비스 호출 → 응답만 수행한다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버 (DB), Zod (경로 파라미터
검증), Next.js Route Handler (동적 세그먼트 `[id]`, `params`는 Promise)

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨, `id`는
기본키(PK)이므로 단건 조회에 추가 인덱스나 마이그레이션 불필요

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`), `__tests__/services/`,
`__tests__/api/`

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler) — TRD.md §2.2가
정한 배포 타겟이며, 현재는 로컬 개발 단계로 아직 실제 배포는 되지 않은 상태

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client` 프론트엔드는 이번 기능 범위 밖)

**Performance Goals**: PRD.md §6 / REQUIREMENTS.md NFR-001 — API 응답 300ms 이내(p95).
PK 기반 단건 조회이므로 `002-list-tickets-api`보다 달성이 용이하나, 측정 환경(로컬 vs
프로덕션)에 대한 주의사항은 동일하게 적용된다 — 로컬 측정값을 이 NFR의 충족/미충족 근거로
삼지 않는다.

**Constraints**: API_SPEC.md §3의 요청·응답 형식을 정확히 따라야 함 (Constitution 원칙 II).
`isOverdue` 계산은 DATA_MODEL.md §5.3 규칙과 일치해야 하며, 목록 조회 전용인 DONE 24시간
필터(§5.4)는 이 엔드포인트에 적용하지 않는다 (spec.md FR-003, API_SPEC.md §0 참고 —
`GET /api/tickets/:id`(FR-003)로 조회하면 24시간이 지난 DONE 티켓도 여전히 확인 가능).

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`GET /api/tickets/:id`), 소프트 삭제
미구현 상태이므로 "삭제된 티켓"은 "존재하지 않는 ID"와 동일하게 처리 (spec.md Assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 응답 타입은 기존 `TicketWithMeta`(`src/shared/types`에 이미 정의됨)를 그대로 재사용. `any` 미사용 | PASS |
| II. API 응답 명세 준수 | 응답 구조(단건 `TicketWithMeta`)와 상태 코드(200/400/404/500)는 `docs/API_SPEC.md` §3을 그대로 따름 (Phase 1 contracts에서 재확인) | PASS |
| III. 표준 에러 응답 형식 | 400은 `INVALID_ID`, 404는 `TICKET_NOT_FOUND`, 500은 `INTERNAL_ERROR` — 모두 `{ error: { code, message } }` 형식만 사용 | PASS |
| IV. Zod 기반 요청 검증 | 경로 파라미터 `id`를 `src/shared/validations/ticket.ts`의 신규 스키마로 검증한 뒤에만 서비스 레이어에 전달 | PASS |
| V. 서비스 레이어 분리 | 단건 조회 로직은 `src/server/services/ticketService.ts`에 위치. Route Handler는 파싱(id 검증)→서비스 호출→응답만 수행. DB 접근은 Drizzle만 사용 | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다.

## Project Structure

### Documentation (this feature)

```text
specs/003-get-ticket-detail/
├── spec.md                    # 완료 (요구사항 명세)
├── plan.md                    # 이 파일
├── data-model.md              # Phase 1 산출물
├── quickstart.md              # Phase 1 산출물
├── contracts/
│   └── get-ticket-detail.md   # Phase 1 산출물
└── tasks.md                   # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
src/shared/
└── validations/ticket.ts        # ticketIdParamSchema 추가 — id 경로 파라미터 검증
                                  # (양의 정수 coerce)

src/server/
└── services/ticketService.ts    # getTicketById(id) 추가 — PK 단건 조회, isOverdue 계산
                                  # (toTicketWithMeta 기존 헬퍼 재사용, DONE 24시간
                                  # 필터는 적용하지 않음)

app/api/tickets/
└── [id]/route.ts                # 신규 — GET 핸들러 (id 검증→서비스 호출→응답)

__tests__/
├── services/ticketService.test.ts   # getTicketById() 단위 테스트 추가
└── api/tickets.test.ts              # GET /api/tickets/:id 통합 테스트 추가
                                      # (TEST_CASES.md TC-API-003-01~06)
```

**Structure Decision**: `001-create-ticket-api`, `002-list-tickets-api`와 동일한 3계층 구조
(`app/api` ↔ `src/server` ↔ `src/shared`)를 그대로 따른다. Next.js App Router 컨벤션상
경로 파라미터가 있는 리소스(`/api/tickets/:id`)는 `[id]` 동적 세그먼트 폴더로 분리해야
하므로, 기존 `app/api/tickets/route.ts`(파라미터 없는 `/api/tickets`)와는 별도 파일로
`app/api/tickets/[id]/route.ts`를 신규 생성한다. 서비스 레이어는 기존
`ticketService.ts`에 함수를 추가하는 방식을 유지해 리소스별 단일 진실 공급원 원칙을
지킨다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
