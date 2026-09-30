# Quickstart: 티켓 삭제 API 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (이번 기능은 추가 마이그레이션 없음)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`로 먼저 티켓을 만든 뒤 그 `id`를 사용한다.

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"삭제 확인용","priority":"LOW"}'
# 응답의 id를 아래에서 :id 로 사용 (예: 1)
```

## 정상 케이스

**삭제** (TC-API-006-01)

```bash
curl -i -X DELETE http://localhost:3000/api/tickets/1
```

기대: `204 No Content`, 응답 본문 없음.

**삭제 후 조회** (TC-API-006-01, 006-02)

```bash
curl -i http://localhost:3000/api/tickets/1
curl http://localhost:3000/api/tickets
```

기대: 상세 조회는 `404 TICKET_NOT_FOUND`, 보드 목록에는 해당 티켓이 없음.

**이미 삭제한 id 재요청** (TC-API-006-05)

```bash
curl -i -X DELETE http://localhost:3000/api/tickets/1
```

기대: `404`, `TICKET_NOT_FOUND` (성공으로 처리되지 않음).

**본문을 보내도 동일** (spec FR-006)

```bash
curl -i -X DELETE http://localhost:3000/api/tickets/2 \
  -H "Content-Type: application/json" -d 'not json'
```

기대: 본문 없이 보냈을 때와 같은 결과(`400`이 아님).

## 오류 케이스

| 요청 | 기대 결과 |
|------|------|
| `DELETE /api/tickets/abc` | `400`, `INVALID_ID` |
| `DELETE /api/tickets/0` | `400`, `INVALID_ID` |
| `DELETE /api/tickets/999999` | `404`, `TICKET_NOT_FOUND`, "존재하지 않거나 삭제된 티켓입니다" |

## 자동 검증

수동 curl은 보조 수단이며 공식 검증은 자동 테스트로 수행한다.

```bash
npm run test -- __tests__/api/tickets.test.ts __tests__/services/ticketService.test.ts
npx tsc --noEmit
```

TC-API-006-01~05와 spec의 추가 케이스를 포함한다. "DB에서 완전히 제거"(TC-API-006-02)와 "다른
티켓 불변"은 자동 테스트에서 DB를 직접 조회해 확인한다.
