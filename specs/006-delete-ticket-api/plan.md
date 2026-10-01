# Implementation Plan: 티켓 삭제 API

**Branch**: `006-delete-ticket-api` (git 브랜치: `feature/delete-ticket`) | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-delete-ticket-api/spec.md`

## Summary

`DELETE /api/tickets/:id` 엔드포인트를 구현한다. 요청 본문은 사용하지 않는다. 지정한 티켓을
DB에서 완전히 제거(Hard Delete)하고 성공 시 본문 없는 `204`를 반환한다. 존재하지 않거나 이미
삭제된 id는 `404 TICKET_NOT_FOUND`(문구: "존재하지 않거나 삭제된 티켓입니다"), 형식이 잘못된
id는 `400 INVALID_ID`다. 다른 티켓의 `position`은 재정렬하지 않는다.

기술 접근은 `001~005`와 동일한 3계층 분리를 따른다.
- `src/server/services/ticketService.ts`에 `deleteTicket(id): Promise<boolean>`을 추가한다.
  `DELETE FROM tickets WHERE id = ? RETURNING id` 한 번으로 "존재 여부 확인 + 삭제"를 원자적으로
  처리하고, 반환 행이 있으면 `true`, 없으면 `false`를 반환한다.
- 기존 `app/api/tickets/[id]/route.ts`에 `DELETE` 핸들러를 추가한다(같은 경로 `/api/tickets/:id`의
  HTTP 메서드 하나일 뿐이라 새 디렉터리가 필요 없다). `id`만 `ticketIdParamSchema`로 검증하고
  본문은 읽지 않는다.
- 새 Zod 스키마·새 타입·DB 마이그레이션은 없다.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router)

**Primary Dependencies**: Drizzle ORM 0.45 + `postgres` 드라이버, Zod(경로 파라미터 검증에 기존
`ticketIdParamSchema` 재사용), Next.js Route Handler (`params`는 Promise)

**Storage**: PostgreSQL — `tickets` 테이블은 `src/server/db/schema.ts`에 이미 구현됨. 다른
테이블이 `tickets`를 참조하는 외래 키가 없어 연쇄 삭제 고려가 필요 없다. 마이그레이션 없음.

**Testing**: Jest 30 (`node` 환경, `/** @jest-environment node */`, `--runInBand`),
`__tests__/services/`, `__tests__/api/`. 공유 DB(`tika_test`) 사용. 파일 끝의 최상위
`afterAll(() => db.$client.end())`는 이미 있으므로 유지한다.

**Target Platform**: Vercel (Node.js 서버리스 함수, App Router Route Handler) — 현재는 로컬 개발
단계

**Project Type**: Web application — Next.js App Router 기반 프론트/백엔드 단일 저장소
(`app/api` + `src/server` 백엔드, `src/client`는 이번 범위 밖)

**Performance Goals**: NFR-001 — API 응답 300ms 이내(p95). 쿼리는 `DELETE ... RETURNING` 1회다.
로컬 측정값을 NFR 충족 근거로 삼지 않는다(`002~005`와 동일한 주의).

**Constraints**: `docs/API_SPEC.md` §6의 요청·응답 형식 준수(Constitution 원칙 II). §6의 500
응답 행은 반영 완료(research.md "문서 정리 항목"). 204 응답은 본문이 없어야
하므로 `NextResponse.json`이 아니라 `new Response(null, { status: 204 })`를 사용한다.

**Scale/Scope**: MVP, 단일 사용자, 엔드포인트 1개(`DELETE /api/tickets/:id`). 일괄 삭제,
복구(휴지통), 삭제 확인 UI 등 프론트엔드 연동은 범위 밖.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 방식 | 상태 |
|------|----------|------|
| I. TypeScript Strict Mode | 새 공유 타입 없음. `any` 미사용, 요청 본문은 읽지 않음 | PASS |
| II. API 응답 명세 준수 | 상태 코드(204/400/404/500)와 404 문구는 모두 API_SPEC.md §6에 반영됨 | PASS |
| III. 표준 에러 응답 형식 | 400 `INVALID_ID`, 404 `TICKET_NOT_FOUND`, 500 `INTERNAL_ERROR` 모두 `{ error: { code, message } }` | PASS |
| IV. Zod 기반 요청 검증 | 경로 파라미터는 기존 `ticketIdParamSchema`로 서비스 호출 전에 검증. 본문은 명세상 없으므로 본문 스키마 없음(spec FR-006) | PASS |
| V. 서비스 레이어 분리 | 삭제 로직은 `ticketService.deleteTicket`에 위치. Route Handler는 id 검증→서비스 호출→응답만 수행. DB는 Drizzle만 사용(raw SQL 없음) | PASS |

위반 없음 — Complexity Tracking 섹션은 비워둔다. 원칙 II의 문서 선행 수정 1건(500 응답 행)은
사용자 승인 후 API_SPEC.md §6에 반영해 해소했다.

**Phase 1 설계 후 재검토**: 설계(data-model.md, contracts/delete-ticket.md) 결과 위 판정이 바뀌지
않았다.

## Project Structure

### Documentation (this feature)

```text
specs/006-delete-ticket-api/
├── spec.md                    # 완료 (요구사항 명세)
├── plan.md                    # 이 파일
├── research.md                # Phase 0 산출물
├── data-model.md              # Phase 1 산출물
├── quickstart.md              # Phase 1 산출물
├── contracts/
│   └── delete-ticket.md       # Phase 1 산출물
├── checklists/
│   └── requirements.md        # 완료 (명세 품질 체크리스트)
└── tasks.md                   # /speckit-tasks에서 생성 (이번 범위 아님)
```

### Source Code (repository root)

```text
docs/
└── API_SPEC.md                    # §6에 500 응답 행 추가 완료

src/shared/
├── types/index.ts                 # 변경 없음
└── validations/ticket.ts          # 변경 없음 — ticketIdParamSchema 재사용

src/server/
└── services/ticketService.ts      # deleteTicket(id) 추가

app/api/tickets/[id]/
├── route.ts                       # DELETE 핸들러 추가 (기존 GET, PATCH 옆)
└── complete/route.ts              # 변경 없음

__tests__/
├── services/ticketService.test.ts # deleteTicket() 단위 테스트 추가
└── api/tickets.test.ts            # DELETE /api/tickets/:id 테스트 추가
                                   # (TEST_CASES.md TC-API-006-01~05)
```

**Structure Decision**: `001~005`와 동일한 3계층 구조(`app/api` ↔ `src/server` ↔ `src/shared`)를
따른다. `DELETE`는 `GET`/`PATCH`와 같은 `/api/tickets/:id` 경로이므로 기존 `[id]/route.ts`에
핸들러를 추가한다(`/complete`처럼 별도 세그먼트가 아님). 서비스는 기존 `ticketService.ts`에,
테스트는 기존 `tickets.test.ts`/`ticketService.test.ts`에 추가한다. 프론트엔드(`src/client`)는
경계 규칙상 이번 범위에서 수정하지 않는다.

## Complexity Tracking

> 해당 없음 — Constitution Check 위반 없음.
