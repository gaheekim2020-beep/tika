# Implementation Plan: 티켓 생성 API

**Branch**: `feature/create-ticket-api` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-create-ticket-api/spec.md`

## Summary

사용자가 제목만으로, 또는 설명/우선순위/시작예정일/종료예정일을 포함해 새 할 일을 등록할 수
있는 `POST /api/tickets` 엔드포인트를 구현한다. 신규 항목은 항상 `BACKLOG` 상태로, 해당
칼럼 최상단(`position = 최솟값 - 1024`, 없으면 `1024`)에 배치된다.

기술 접근은 계층을 명확히 분리한다: 요청 body는 `src/shared/validations`의 Zod 스키마로
검증하고, 검증된 입력만 `src/server/services/ticketService.ts`의 비즈니스 로직(position
계산, `isOverdue` 파생 등)에 전달하며, `app/api/tickets/route.ts`의 Route Handler는
파싱 → 서비스 호출 → 응답 반환만 수행하는 얇은 계층으로 유지한다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Zod 4 (검증), Drizzle ORM 0.45 + `postgres` 드라이버 (DB), Next.js Route Handler

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨 (DATA_MODEL.md §3과 일치, 추가 마이그레이션 불필요)

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`), `__tests__/services/`, `__tests__/api/`

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler)

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소 (`app/api` + `src/server` 백엔드, `src/client` 프론트엔드는 이번 기능 범위 밖)

**Performance Goals**: 별도 명시 없음 — 표준 웹 API 응답 시간 기대치(수백 ms 이내) 수준

**Constraints**: API_SPEC.md §0/§1의 요청·응답 형식을 정확히 따라야 함 (Constitution 원칙 II)

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`POST /api/tickets`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | `CreateTicketInput`은 Zod 스키마에서 `z.infer`로 파생, `any` 미사용. 공유 타입은 `src/shared/types`에서만 정의 | PASS |
| II. API 응답 명세 준수 | Route Handler/서비스의 응답 필드·상태 코드(201/400/500)는 `docs/API_SPEC.md` §1을 그대로 따름 (Phase 1 contracts에서 재확인) | PASS |
| III. 표준 에러 응답 형식 | 모든 에러 응답은 `{ error: { code, message, field? } }` 형식만 사용. 서비스 레이어는 도메인 에러를 throw하고 Route Handler가 이 형식으로 변환 | PASS |
| IV. Zod 기반 요청 검증 | 요청 body는 `src/shared/validations/ticket.ts`의 `createTicketSchema`로 검증 후에만 서비스에 전달. 검증되지 않은 입력은 서비스에 도달하지 않음 | PASS |
| V. 서비스 레이어 분리 | 비즈니스 로직(status 고정, position 계산, isOverdue 계산)은 전부 `src/server/services/ticketService.ts`에 위치. Route Handler는 파싱→호출→응답만 수행. DB 접근은 Drizzle만 사용 | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다.

## Project Structure

### Documentation (this feature)

```text
specs/001-create-ticket-api/
├── spec.md               # 완료 (요구사항 명세)
├── plan.md                # 이 파일
├── data-model.md          # Phase 1 산출물
├── quickstart.md          # Phase 1 산출물
├── contracts/
│   └── post-tickets.md    # Phase 1 산출물
└── tasks.md                # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
src/shared/
├── types/index.ts               # CreateTicketInput 등 API 계약 타입 추가 (기존 TICKET_STATUS/PRIORITY 상수 옆)
└── validations/ticket.ts        # createTicketSchema (Zod) — 신규 파일

src/server/
├── db/schema.ts                 # 이미 구현됨 (변경 없음)
└── services/ticketService.ts    # createTicket() — 신규 파일, position 계산·BACKLOG 고정·isOverdue 계산

app/api/tickets/
└── route.ts                     # POST 핸들러 — 신규 파일

__tests__/
├── services/ticketService.test.ts   # node 환경, 서비스 단위 테스트
└── api/tickets.test.ts              # node 환경, Route Handler 통합 테스트 (TEST_CASES.md TC-API-001-*)
```

**Structure Decision**: 기존 TRD.md/CLAUDE.md가 정의한 `app/api` ↔ `src/server` ↔
`src/shared` 3계층 구조를 그대로 따른다. 이번 기능은 새 디렉토리를 만들지 않고, 각 계층에
파일 하나씩만 추가한다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
