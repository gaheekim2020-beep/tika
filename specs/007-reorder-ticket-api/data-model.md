# Data Model: 티켓 상태/순서 변경 API

이 기능은 새 DB 스키마와 새 응답 타입을 도입하지 않는다. `tickets` 테이블 정의는
`docs/DATA_MODEL.md`와 `src/server/db/schema.ts`(이미 구현됨)를 단일 진실 공급원으로 한다. 이
문서는 이동이 기존 데이터에 미치는 영향, 신규 검증 스키마, 신규 서비스 함수의 책임을 정리한다.

## 사용하는 기존 타입·스키마

- 입력 타입 `ReorderTicketInput { ticketId: number; status: ReorderableStatus; position: number }`와
  `ReorderableStatus`(= `TicketStatus`에서 `DONE` 제외)는 `src/shared/types/index.ts`에 이미 있다.
  변경하지 않는다(CLAUDE.md "타입 변경 시 shared 먼저" 해당 없음).
- 응답 타입은 `BoardData`(`Record<TicketStatus, TicketWithMeta[]>`)로 `GET /api/tickets`와 같다.
- 경로 파라미터가 없으므로 `ticketIdParamSchema`는 쓰지 않는다. `ticketId`는 본문 필드다.

## 신규 검증 스키마 (`src/shared/validations/ticket.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
export const reorderTicketSchema = z.object({
  ticketId: /* 양의 정수, 메시지 "유효하지 않은 티켓 ID입니다" */,
  status:   /* BACKLOG | TODO | IN_PROGRESS, 메시지 "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" */,
  position: /* 정수, 32비트 범위, 메시지 "위치는 정수로 입력해주세요" */,
});
// z.infer 결과는 ReorderTicketInput과 형태가 일치해야 한다 (constitution 원칙 I)
```

## 이동이 바꾸는 데이터

| 대상 | 이동 후 |
|------|------|
| 이동한 티켓의 `status` | 요청한 대상 칼럼 |
| 이동한 티켓의 `position` | 요청값(충돌 시 재정렬 결과) |
| 이동한 티켓의 `startedAt` | 아래 시각 규칙 |
| 이동한 티켓의 `completedAt` | 이동 전 `DONE`이면 `null`, 아니면 변경 없음 |
| 이동한 티켓의 `updatedAt` | 현재 시각 |
| 이동한 티켓의 제목·설명·우선순위·예정일·종료예정일·`createdAt` | **변경 없음** |
| 대상 칼럼의 다른 티켓 `position` | 충돌이 없으면 변경 없음. 충돌이 있으면 1024 간격으로 재할당(상대 순서 유지), `updatedAt`은 `$onUpdate`로 갱신 |
| 원래 칼럼의 다른 티켓 | 변경 없음 (빈 자리를 메우는 재정렬 없음) |
| 다른 칼럼의 티켓 | 변경 없음 |

## 시각 규칙

| 이동 전 → 대상 | `startedAt` | `completedAt` |
|------|------|------|
| `BACKLOG` → `TODO` | `null`이면 현재 시각, 아니면 유지 | 유지(`null`) |
| `BACKLOG` → `IN_PROGRESS` | `null`이면 현재 시각, 아니면 유지 | 유지(`null`) |
| `TODO` ↔ `IN_PROGRESS` | `null`이면 현재 시각, 아니면 유지 | 유지(`null`) |
| `TODO` → `BACKLOG` | `null`로 초기화 | 유지(`null`) |
| `IN_PROGRESS` → `BACKLOG` | `null`로 초기화 | 유지(`null`) |
| `DONE` → `BACKLOG` | `null`로 초기화 | `null`로 초기화 |
| `BACKLOG` → `BACKLOG` (같은 칼럼 순서 변경) | `null` 유지 | 유지(`null`) |
| `DONE` → `TODO` / `IN_PROGRESS` | `null`이면 현재 시각, 아니면 유지 | `null`로 초기화 |
| 같은 칼럼 안 순서 변경 | 대상이 `TODO`/`IN_PROGRESS`이고 `null`이면 현재 시각, 아니면 유지 | 유지 |
| 어느 칼럼 → `DONE` | 허용되지 않음 (검증 단계에서 400) | — |

## 상태 전이

```text
BACKLOG ◀──────────────▶ TODO ◀──────────────▶ IN_PROGRESS
   ▲  (이동 허용: 세 칼럼 사이 임의 방향)              ▲
   └──────────────────────┐                          │
                          │                          │
DONE ──(reorder: completedAt = null)──▶ BACKLOG / TODO / IN_PROGRESS

BACKLOG / TODO / IN_PROGRESS ──(reorder)──▶ DONE   ✗ 400 (PATCH /api/tickets/:id/complete 사용)
(없는 ticketId) ──(reorder)──▶ 404, 변경 없음
```

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function reorderTicket(input: ReorderTicketInput): Promise<BoardData | null>   // 신규
```

**`reorderTicket(input)` 책임** (모두 하나의 `db.transaction` 안, 순서대로):
1. `ticketId` 행을 `FOR UPDATE`로 조회한다. 없으면 `null`을 반환한다(트랜잭션은 변경 없이 종료).
2. 이동 전 `status`, `startedAt`과 대상 `status`로 `startedAt`·`completedAt`을 계산한다(위 시각 규칙).
3. 이동 티켓을 제외한 대상 칼럼 티켓을 `position`, `id` 오름차순으로 조회한다.
4. 요청 `position`과 같은 값이 있으면 충돌 → `[더 작은 값들] + [이동 티켓] + [같거나 큰 값들]` 순서로
   `1024, 2048, …`를 재할당해 이동 티켓과 값이 바뀐 티켓을 갱신한다. 없으면 이동 티켓만 요청값으로
   갱신한다.
5. 트랜잭션 커밋 후 `getBoardData()`를 호출해 `BoardData`를 반환한다(24시간이 지난 DONE 제외 규칙은
   `getBoardData`가 이미 처리).

**에러**: DB 오류는 그대로 throw하고(트랜잭션 롤백) Route Handler가 500으로 변환한다. 서비스는 HTTP
상태 코드를 모른다(Constitution 원칙 V).

## 불변 조건 (테스트로 고정)

- 이동 후 같은 칼럼 안에서 `position`이 중복되는 티켓은 없다(단, 이동 이전부터 중복이던 기존 데이터는
  충돌 요청이 없는 한 건드리지 않는다).
- 충돌 재정렬 후 칼럼의 상대 순서는 "이동 티켓을 제외한 기존 순서"와 "이동 티켓은 겹친 티켓 바로
  앞"을 만족한다.
- 이동이 실패(예외·404·검증 오류)하면 어떤 행의 어떤 컬럼도 바뀌지 않는다.
