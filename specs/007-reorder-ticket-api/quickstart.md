# Quickstart: 티켓 상태/순서 변경 API 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (이번 기능은 추가 마이그레이션 없음)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`로 티켓 몇 개를 만든 뒤 그 `id`를 사용한다. 새 티켓은 항상
  `BACKLOG` 맨 위에 생성된다.

```bash
for t in A B C; do
  curl -s -X POST http://localhost:3000/api/tickets \
    -H "Content-Type: application/json" -d "{\"title\":\"$t\"}"
done
# 응답의 id와 position을 기록해 둔다 (예: A=1, B=2, C=3)
```

## 0. 경로 충돌 확인 (가장 먼저)

`/api/tickets/reorder`가 `PATCH /api/tickets/[id]`(004)로 빠지지 않고 새 핸들러로 가는지 확인한다.
핸들러를 직접 호출하는 Jest 테스트는 라우팅을 거치지 않으므로 이 확인은 `curl`로만 할 수 있다.

```bash
curl -i -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":1,"status":"TODO","position":1024}'
```

기대: `200`과 보드 전체. 만약 `400 INVALID_ID`("유효하지 않은 티켓 ID입니다")가 오면 `[id]/route.ts`가
요청을 가로챈 것이므로 라우트 구조를 다시 검토한다.

## 정상 케이스

**다른 칼럼으로 이동 + 시작 시각 기록** (TC-API-007-05, 007-06)

```bash
curl -s -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":1,"status":"IN_PROGRESS","position":1024}'
```

기대: 응답 보드의 `IN_PROGRESS`에 `id=1`이 있고 `startedAt`이 현재 시각, `BACKLOG`에는 없음.

**같은 칼럼에서 순서 변경** (TC-API-007-01~03)

```bash
# BACKLOG의 두 티켓 position 사이 값으로 이동 (예: 앞 1024, 뒤 2048 사이 → 1536)
curl -s -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":3,"status":"BACKLOG","position":1536}'
```

기대: 요청한 `position` 그대로 저장되고 보드의 `BACKLOG`가 `position` 오름차순.

**값이 겹칠 때 재정렬** (TC-API-007-04)

```bash
# 대상 칼럼의 기존 티켓과 같은 position으로 이동
curl -s -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":2,"status":"IN_PROGRESS","position":1024}'
```

기대: `IN_PROGRESS`의 position이 `1024, 2048, …`로 다시 매겨지고 이동한 티켓(`id=2`)이 겹친 티켓보다
앞에 있다. 다른 칼럼의 position은 그대로.

**백로그 복귀 / 완료 해제** (TC-API-007-08, 007-09)

```bash
curl -s -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":1,"status":"TODO","position":1024}'
curl -s -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":1,"status":"BACKLOG","position":1024}'
```

기대: BACKLOG로 이동한 뒤 `startedAt`이 `null`. (완료 해제는 `PATCH /api/tickets/:id/complete`로 완료한
티켓을 `TODO` 등으로 이동 → `completedAt = null`.)

## 예외 케이스

**DONE으로 이동 시도** (TC-API-007-11)

```bash
curl -i -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":1,"status":"DONE","position":1024}'
```

기대: `400`, `VALIDATION_ERROR`, "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요", `field` 없음.

**존재하지 않는 티켓** (TC-API-007-13)

```bash
curl -i -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":999999,"status":"TODO","position":1024}'
```

기대: `404`, `TICKET_NOT_FOUND`, "존재하지 않거나 삭제된 티켓입니다".

**형식이 잘못된 요청** (spec FR-010)

```bash
curl -i -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" -d '{"ticketId":1,"status":"TODO","position":1.5}'
curl -i -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" -d 'not json'
```

기대: 첫 번째는 `400`, `field="position"`. 두 번째는 `400`, `field` 없음, "요청 본문이 올바른 JSON
형식이 아닙니다".

## 자동 테스트

```bash
npm run test -- __tests__/services/ticketService.test.ts --runInBand
npm run test -- __tests__/api/tickets.test.ts --runInBand
npx tsc --noEmit
```

기대: `reorderTicket`/`PATCH /api/tickets/reorder` 관련 테스트가 모두 통과하고 타입 오류가 없다.
