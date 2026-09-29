# Quickstart: 티켓 수정 API 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (이번 기능은 추가 마이그레이션 없음)
- `docs/API_SPEC.md` §4 수정이 끝나 있을 것 (`null` 허용, JSON 형식 오류 행 — research.md)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`로 먼저 티켓을 만든 뒤 그 `id`를 사용한다

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"수정 확인용","description":"원래 설명","priority":"LOW","plannedStartDate":"2026-10-01","dueDate":"2026-12-31"}'
# 응답의 id를 아래에서 :id 로 사용 (예: 1)
```

## 정상 케이스

**제목만 수정** (TC-API-004-01)

```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" -d '{"title":"수정된 제목"}'
```

기대: `200`, `title`만 바뀌고 나머지 유지, `updatedAt` 갱신.

**설명·시작예정일 비우기** (TC-API-004-03, 004-04)

```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" -d '{"description":null,"plannedStartDate":null}'
```

기대: `200`, 두 필드가 `null`.

**빈 body** (TC-API-004-05)

```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" -d '{}'
```

기대: `200`, 값은 그대로, `updatedAt`만 갱신.

## 오류 케이스

| 요청 | 기대 결과 |
|------|------|
| `-d '{"title":"   "}'` | `400`, `field: "title"`, "제목을 입력해주세요" |
| `-d '{"priority":"URGENT"}'` | `400`, `field: "priority"` |
| `-d '{"dueDate":"2020-01-01"}'` | `400`, `field: "dueDate"` |
| `-d 'not json'` | `400`, `VALIDATION_ERROR` (field 없음) |
| `PATCH /api/tickets/abc` | `400`, `INVALID_ID` |
| `PATCH /api/tickets/999999` (유효한 본문) | `404`, `TICKET_NOT_FOUND` |
| `-d '{"status":"DONE"}'` | `200`, 상태·순서는 그대로 |

여러 필드 중 하나만 무효(예: `{"title":"정상","priority":"URGENT"}`)이면 `400`이고 `title`도
반영되지 않아야 한다(조회로 확인).

## 자동 검증

수동 curl은 보조 수단이며 공식 검증은 자동 테스트로 수행한다.

```bash
npm run test -- __tests__/api/tickets.test.ts __tests__/services/ticketService.test.ts
npx tsc --noEmit
```

TC-API-004-01~12와 spec의 추가 케이스를 포함한다. `updatedAt` 갱신 비교는 시간 차이가 작아
curl로 재현하기 어렵기 때문에 자동 테스트가 기준이다(과거 `updatedAt`으로 삽입한 행 사용).
