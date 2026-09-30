# Quickstart: 티켓 완료 처리 API 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (이번 기능은 추가 마이그레이션 없음)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`로 먼저 티켓을 만든 뒤 그 `id`를 사용한다. 새 티켓은
  BACKLOG 상태로 만들어진다 (TODO/IN_PROGRESS 상태가 필요하면 DB에서 `status`를 직접 바꾸거나
  자동 테스트를 사용한다)

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"완료 확인용","priority":"LOW","dueDate":"2026-12-31"}'
# 응답의 id를 아래에서 :id 로 사용 (예: 1)
```

## 정상 케이스

**완료 처리** (TC-API-005-01, 005-03)

```bash
curl -X PATCH http://localhost:3000/api/tickets/1/complete
```

기대: `200`, `status="DONE"`, `completedAt`이 현재 시각, `updatedAt`이 `completedAt`과 같은 값,
Done 칼럼이 비어 있었다면 `position=1024`, `isOverdue=false`. 나머지 필드는 그대로.

**다른 티켓을 이어서 완료** (TC-API-005-04)

```bash
# 새 티켓(id=2)을 만든 뒤
curl -X PATCH http://localhost:3000/api/tickets/2/complete
```

기대: `200`, 새 티켓의 `position`이 먼저 완료한 티켓(1024)보다 작음(`0`) — 칼럼 맨 위.

**보드에서 확인**

```bash
curl http://localhost:3000/api/tickets
```

기대: `DONE` 배열에 두 티켓이 있고 방금 완료한 티켓이 맨 앞.

**이미 완료된 티켓에 다시 요청** (TC-API-005-07)

```bash
curl -X PATCH http://localhost:3000/api/tickets/1/complete
```

기대: `200`, `completedAt`·`position`·`updatedAt`이 이전 응답과 동일.

**본문을 보내도 동일** (spec FR-007)

```bash
curl -X PATCH http://localhost:3000/api/tickets/3/complete \
  -H "Content-Type: application/json" -d 'not json'
```

기대: 본문 없이 보냈을 때와 같은 결과(`400`이 아님).

## 오류 케이스

| 요청 | 기대 결과 |
|------|------|
| `PATCH /api/tickets/abc/complete` | `400`, `INVALID_ID` |
| `PATCH /api/tickets/0/complete` | `400`, `INVALID_ID` |
| `PATCH /api/tickets/999999/complete` | `404`, `TICKET_NOT_FOUND`, "존재하지 않거나 삭제된 티켓입니다" |

## 자동 검증

수동 curl은 보조 수단이며 공식 검증은 자동 테스트로 수행한다.

```bash
npm run test -- __tests__/api/tickets.test.ts __tests__/services/ticketService.test.ts
npx tsc --noEmit
```

TC-API-005-01~07, TC-API-008-09와 spec의 추가 케이스를 포함한다. `completedAt`·`updatedAt`
비교는 시간 차이가 작아 curl로 재현하기 어렵기 때문에 자동 테스트가 기준이다(요청 전후 시각
범위로 확인하고, 멱등 케이스는 과거 시각으로 삽입한 DONE 행을 사용).
