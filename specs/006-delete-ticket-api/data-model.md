# Data Model: 티켓 삭제 API

이 기능은 새 DB 스키마, 새 응답 타입, 새 검증 스키마를 도입하지 않는다. `tickets` 테이블 정의는
`docs/DATA_MODEL.md`와 `src/server/db/schema.ts`(이미 구현됨)를 단일 진실 공급원으로 한다. 이
문서는 삭제가 기존 데이터에 미치는 영향과 신규 서비스 함수의 책임을 정리한다.

## 사용하는 기존 타입·스키마

- 요청 본문 타입은 없다(본문 없음). 경로 파라미터 `id`는 `003`에서 추가된
  `ticketIdParamSchema`(양의 정수)를 그대로 사용한다.
- 성공 응답은 본문이 없는 `204`라 응답 타입도 없다.

## 삭제의 데이터 영향

| 대상 | 삭제 후 |
|------|------|
| 지정한 티켓 행 | 완전히 제거됨 (Hard Delete, 삭제 플래그 없음) |
| 같은 칼럼의 다른 티켓 `position` | 변경 없음 (재정렬하지 않음) |
| 다른 칼럼의 티켓 | 변경 없음 |
| 다른 티켓의 `updatedAt` | 변경 없음 |
| 다른 테이블 | `tickets`를 참조하는 외래 키 없음 — 영향 없음 |

- 출발 상태(BACKLOG / TODO / IN_PROGRESS / DONE)에 따른 차이는 없다. 24시간이 지나 보드에서 숨겨진
  DONE 티켓도 동일하게 삭제된다.

## 상태 전이

```text
BACKLOG ──┐
TODO ─────┤
IN_PROGRESS ──(DELETE /api/tickets/:id)──▶ (존재하지 않음)
DONE ─────┘

(존재하지 않음) ──(DELETE)──▶ 404, 변경 없음
```

## 서비스 함수 (`src/server/services/ticketService.ts`)

```typescript
// 개념적 시그니처 (실제 구현은 /speckit-implement에서)
async function deleteTicket(id: number): Promise<boolean>   // 신규
```

**`deleteTicket(id)` 책임**:
1. `DELETE FROM tickets WHERE id = ? RETURNING id`를 Drizzle로 한 번 실행한다.
2. 반환 행이 있으면 `true`(삭제됨), 없으면 `false`(존재하지 않음)를 반환한다.

**에러**: DB 오류는 그대로 throw하고 Route Handler가 500으로 변환한다(서비스는 HTTP 상태 코드를
모른다 — Constitution 원칙 V).

## Route Handler (`app/api/tickets/[id]/route.ts` — `DELETE` 추가)

**책임** (얇게 유지):
1. `params.id`를 `ticketIdParamSchema`로 검증 — 실패 시 400 `INVALID_ID`.
2. 요청 본문은 읽지 않는다.
3. `deleteTicket(id)` 호출.
4. `false`면 404 `TICKET_NOT_FOUND`, `true`면 본문 없는 204.
5. 예외는 catch하여 500 `INTERNAL_ERROR`.
