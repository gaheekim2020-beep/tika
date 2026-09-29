# Implementation Plan: 티켓 목록 조회 API (보드)

**Branch**: `feature/create-ticket-api` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-list-tickets-api/spec.md`

## Summary

사용자가 보드 화면에 진입했을 때 전체 티켓을 4개 상태(`BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE`)로
그룹화해 한 번에 조회할 수 있는 `GET /api/tickets` 엔드포인트를 구현한다. 각 컬럼 내 티켓은
`position` 오름차순으로 정렬되고, `DONE` 컬럼은 `completedAt` 기준 24시간 이내 완료된 티켓만
포함하며, 모든 티켓에 조회 시점 기준 `isOverdue` 파생 필드를 계산해 함께 반환한다.

기술 접근은 `001-create-ticket-api`와 동일한 계층 분리를 따른다: 요청 파라미터가 없는 단순
조회이므로 별도 Zod 스키마는 불필요하고, `src/server/services/ticketService.ts`에 조회+그룹화
로직을 추가하며(기존 `calculateIsOverdue` 헬퍼 재사용), `app/api/tickets/route.ts`에 기존
`POST` 핸들러와 같은 파일 내 `GET` 핸들러를 추가해 조회 → 그룹화 위임 → 응답 반환만 수행한다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버 (DB), Next.js Route Handler
(요청 파라미터 없음 — Zod 검증 불필요)

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨, 조회에
필요한 인덱스(`idx_tickets_status_position`, `idx_tickets_completed_at`)도 이미 존재 (추가
마이그레이션 불필요)

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`), `__tests__/services/`,
`__tests__/api/`

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler) — TRD.md §2.2가
정한 배포 타겟이며, 현재는 로컬 개발 단계로 아직 실제 배포는 되지 않은 상태

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client` 프론트엔드는 이번 기능 범위 밖)

**Performance Goals**: PRD.md §6 / REQUIREMENTS.md NFR-001 — API 응답 300ms 이내(p95).
"보드 초기 로드 2초 이내"는 프론트엔드 렌더링까지 포함한 별도 지표라 이 API 단독의
목표로 재정의하지 않지만, 이 API가 그 예산 안에서 응답해야 하는 전제 조건이다.
**측정 환경 주의**: 이 수치는 Vercel + Vercel Postgres(Neon) 프로덕션 배포를 전제로 한
목표다. 현재 개발 단계(로컬 PostgreSQL, `npm run dev`)는 네트워크 지연·커넥션 방식·
콜드스타트 여부가 프로덕션과 다르므로, 로컬 측정값을 이 NFR의 충족/미충족 근거로 삼지
않는다 — 이번 기능 구현·테스트 단계에서는 참고 지표로만 취급한다

**Constraints**: API_SPEC.md §2의 요청·응답 형식을 정확히 따라야 함 (Constitution 원칙 II).
`DONE` 24시간 필터와 `isOverdue` 계산은 DATA_MODEL.md §5.3 규칙과 일치해야 함

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`GET /api/tickets`), 페이지네이션/필터링
없음 (spec.md Assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 응답 타입은 기존 `BoardData = Record<TicketStatus, TicketWithMeta[]>`(`src/shared/types`에 이미 정의됨)를 그대로 재사용. `any` 미사용 | PASS |
| II. API 응답 명세 준수 | 응답 구조(4개 상태 키 객체)와 상태 코드(200/500)는 `docs/API_SPEC.md` §2를 그대로 따름 (Phase 1 contracts에서 재확인) | PASS |
| III. 표준 에러 응답 형식 | 500 에러는 `{ error: { code: "INTERNAL_ERROR", message: "티켓 목록을 불러오지 못했습니다" } }` 형식만 사용 | PASS |
| IV. Zod 기반 요청 검증 | 이 엔드포인트는 요청 body/query/params가 없어 검증 대상 입력이 없음 — 원칙이 적용될 대상 자체가 없으므로 위반 아님 | PASS (해당 없음) |
| V. 서비스 레이어 분리 | 조회+그룹화+정렬+`isOverdue` 계산 로직은 전부 `src/server/services/ticketService.ts`에 위치. Route Handler는 서비스 호출→응답만 수행. DB 접근은 Drizzle만 사용 | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다.

## Project Structure

### Documentation (this feature)

```text
specs/002-list-tickets-api/
├── spec.md               # 완료 (요구사항 명세)
├── plan.md                # 이 파일
├── data-model.md          # Phase 1 산출물
├── quickstart.md          # Phase 1 산출물
├── contracts/
│   └── get-tickets.md     # Phase 1 산출물
└── tasks.md                # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
src/shared/
└── types/index.ts               # 변경 없음 — BoardData, TicketWithMeta 등 이미 정의됨

src/server/
├── db/schema.ts                 # 변경 없음 (기존 인덱스로 충분)
└── services/ticketService.ts    # getBoardData() 추가 — 전체 조회, 4컬럼 그룹화,
                                  # position 정렬, DONE 24시간 필터, isOverdue 계산
                                  # (calculateIsOverdue 기존 헬퍼 재사용)

app/api/tickets/
└── route.ts                     # 기존 파일에 GET 핸들러 추가 (POST와 같은 파일)

__tests__/
├── services/ticketService.test.ts   # getBoardData() 단위 테스트 추가
└── api/tickets.test.ts              # GET 핸들러 통합 테스트 추가 (TEST_CASES.md TC-API-002-*, TC-API-008-02~05)
```

**Structure Decision**: `001-create-ticket-api`와 동일한 3계층 구조(`app/api` ↔
`src/server` ↔ `src/shared`)를 그대로 따른다. 새 디렉토리나 새 파일을 만들지 않고, 기존
`route.ts`/`ticketService.ts`/`tickets.test.ts`에 각각 GET 관련 코드를 추가하는 방식을
택한다 — Next.js Route Handler 컨벤션상 같은 리소스 경로(`/api/tickets`)의 여러 HTTP
메서드는 한 `route.ts` 파일에 `export async function GET/POST`로 공존하는 것이 표준이며,
서비스 레이어도 이미 `ticketService.ts`가 해당 리소스의 단일 진실 공급원 역할을 하고 있어
새 파일로 분리할 이유가 없다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
