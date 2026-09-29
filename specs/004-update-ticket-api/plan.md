# Implementation Plan: 티켓 수정 API

**Branch**: `004-update-ticket-api` (git 브랜치는 아직 미생성 — 현재 `feature/get-ticket-detail`) | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-update-ticket-api/spec.md`

## Summary

사용자가 기존 티켓의 제목·설명·우선순위·시작예정일·종료예정일 중 원하는 항목만 골라 수정할
수 있는 `PATCH /api/tickets/:id` 엔드포인트를 구현한다(Partial Update). 요청에 포함된
필드만 갱신하고, `updatedAt`은 항상 현재 시각으로 갱신하며(빈 요청 포함), 응답에는 수정된
`dueDate` 기준으로 재계산한 `isOverdue`를 포함한다. `description`, `plannedStartDate`,
`dueDate`는 `null`로 명시해 비울 수 있다. `status`/`position`은 이 API의 처리 대상이
아니다.

기술 접근은 `001~003`과 동일한 3계층 분리를 따른다.
- `src/shared/validations/ticket.ts`에 `updateTicketSchema`를 **별도로** 추가한다
  (`createTicketSchema.partial()`은 `priority`의 `.default()`가 살아남아 PATCH가 우선순위를
  `MEDIUM`으로 덮어쓰고, `null`도 허용하지 못하므로 사용할 수 없다 — research.md 참조).
- `src/server/services/ticketService.ts`에 `updateTicket(id, input)`을 추가한다. 단일
  `UPDATE ... RETURNING` 문으로 존재 확인과 수정을 원자적으로 처리하고, 기존
  `toTicketWithMeta` 헬퍼를 재사용한다.
- 기존 `app/api/tickets/[id]/route.ts`에 `PATCH` 핸들러를 추가한다(파일 신규 생성 없음).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버, Zod (경로 파라미터 및 요청
본문 검증), Next.js Route Handler (`params`는 Promise)

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨. 이번
기능은 스키마 변경/마이그레이션이 없다. `updatedAt`에는 `$onUpdate`가 걸려 있지만 빈 수정
요청에서도 갱신되어야 하므로 서비스가 `updatedAt`을 명시적으로 세팅한다(research.md).

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`, `--runInBand`),
`__tests__/services/`, `__tests__/api/`. 공유 DB(`tika_test`) 사용, 파일 끝의 최상위
`afterAll(() => db.$client.end())`는 이미 있으므로 유지한다.

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler) — 현재는 로컬
개발 단계

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client`는 이번 범위 밖)

**Performance Goals**: NFR-001 — API 응답 300ms 이내(p95). 단일 `UPDATE ... WHERE id = ?
RETURNING` 한 번이므로 별도 사전 조회가 없다. 로컬 측정값을 NFR 충족 근거로 삼지 않는다
(`002`, `003`과 동일한 주의).

**Constraints**: `docs/API_SPEC.md` §4의 요청·응답 형식 준수(Constitution 원칙 II). 단,
API_SPEC.md와 `TEST_CASES.md`/`UpdateTicketInput` 사이에 불일치 2건이 있어 구현 전에 문서를
먼저 정리해야 한다(아래 Constitution Check 및 research.md "문서 정리 필요 항목").

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`PATCH /api/tickets/:id`). 완료 처리,
상태/순서 변경, 삭제는 범위 밖.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 요청 타입은 `src/shared/types`에 이미 있는 `UpdateTicketInput`을 재사용하고 Zod 스키마의 추론 타입이 이와 일치하도록 유지. 응답은 `TicketWithMeta`. `any` 미사용, 요청 본문은 `unknown`으로 받아 Zod로 좁힘 | PASS |
| II. API 응답 명세 준수 | 필드·상태 코드(200/400/404/500)는 API_SPEC.md §4를 따름. **단, 명세에 없는 항목 2건**(① `plannedStartDate`/`dueDate`의 `null` 허용, ② 본문이 JSON이 아닐 때의 400 응답)은 **코드보다 API_SPEC.md를 먼저 수정**해야 한다 | PASS (문서 선행 수정 2건은 API_SPEC.md §4에 반영 완료) |
| III. 표준 에러 응답 형식 | 400 `INVALID_ID`/`VALIDATION_ERROR`, 404 `TICKET_NOT_FOUND`, 500 `INTERNAL_ERROR` 모두 `{ error: { code, message } }` (`field`는 단일 필드 검증 실패 시에만) | PASS |
| IV. Zod 기반 요청 검증 | 경로 파라미터는 기존 `ticketIdParamSchema`, 본문은 신규 `updateTicketSchema`로 서비스 호출 전에 검증. 검증 실패 시 서비스에 도달하지 않음 | PASS |
| V. 서비스 레이어 분리 | 수정 로직(부분 갱신, `updatedAt`, 재계산)은 `ticketService.updateTicket`에 위치. Route Handler는 파싱→검증→서비스 호출→응답만 수행. DB는 Drizzle만 사용(raw SQL 없음) | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다. 조건부 PASS인 원칙 II는 코드 위반이 아니라
"문서 선행 수정" 절차 항목이며, 사용자 승인 후 API_SPEC.md를 수정하면 해소된다.

**Phase 1 설계 후 재검토**: 설계(data-model.md, contracts/update-ticket.md) 결과 위 판정이
바뀌지 않았다. 원칙 II의 문서 선행 수정 항목은 그대로 남아 있다.

## Project Structure

### Documentation (this feature)

```text
specs/004-update-ticket-api/
├── spec.md                    # 완료 (요구사항 명세)
├── plan.md                    # 이 파일
├── research.md                # Phase 0 산출물
├── data-model.md              # Phase 1 산출물
├── quickstart.md              # Phase 1 산출물
├── contracts/
│   └── update-ticket.md       # Phase 1 산출물
├── checklists/
│   └── requirements.md        # 완료 (명세 품질 체크리스트)
└── tasks.md                   # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
docs/
└── API_SPEC.md                    # §4 수정 완료: plannedStartDate/dueDate null 허용,
                                   # 본문 JSON 형식 오류 400 행 추가

src/shared/
├── types/index.ts                 # 변경 없음 — UpdateTicketInput 이미 정의됨
└── validations/ticket.ts          # updateTicketSchema 추가 (default 없음, null 허용,
                                   # dueDate는 오늘 이후 검증, isTodayOrAfter 재사용)

src/server/
└── services/ticketService.ts      # updateTicket(id, input) 추가 — 전달된 키만 SET,
                                   # updatedAt 명시 세팅, RETURNING → toTicketWithMeta

app/api/tickets/
└── [id]/route.ts                  # PATCH 핸들러 추가 (id 검증 → JSON 파싱 → 본문 검증 →
                                   # 서비스 호출 → 응답). 기존 GET은 변경 없음

__tests__/
├── services/ticketService.test.ts # updateTicket() 단위 테스트 추가
└── api/tickets.test.ts            # PATCH /api/tickets/:id 통합 테스트 추가
                                   # (TEST_CASES.md TC-API-004-01~12)
```

**Structure Decision**: `001~003`과 동일한 3계층 구조(`app/api` ↔ `src/server` ↔
`src/shared`)를 따른다. 이미 `app/api/tickets/[id]/route.ts`가 있으므로 같은 파일에 `PATCH`
핸들러를 추가한다(Next.js는 HTTP 메서드별 함수를 한 파일에서 export). 서비스는 기존
`ticketService.ts`에 함수를 추가해 리소스별 단일 진실 공급원 원칙을 지킨다. 프론트엔드
(`src/client`)는 경계 규칙상 이번 범위에서 수정하지 않는다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
