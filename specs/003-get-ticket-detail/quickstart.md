# Quickstart: 티켓 상세 조회 API 수동 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (`tickets` 테이블 존재 확인 완료, 이번 기능은 추가
  마이그레이션 없음)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`(이미 구현됨)로 먼저 데이터를 만든 뒤 확인한다

## 정상 케이스 — 생성 후 상세 조회

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"상세 조회 확인용 티켓"}'

# 위 응답의 "id" 값을 사용
curl http://localhost:3000/api/tickets/1
```

**기대 결과**: `200 OK`, 생성한 티켓의 전체 필드(`isOverdue` 포함)가 반환됨.

## 오류 케이스 — 잘못된 ID 형식

```bash
curl http://localhost:3000/api/tickets/abc
```

**기대 결과**: `400 Bad Request`,
`{"error":{"code":"INVALID_ID","message":"유효하지 않은 티켓 ID입니다"}}`

```bash
curl http://localhost:3000/api/tickets/0
curl http://localhost:3000/api/tickets/-1
```

**기대 결과**: 위와 동일하게 `400 INVALID_ID`.

## 오류 케이스 — 존재하지 않는 ID

```bash
curl http://localhost:3000/api/tickets/999999
```

**기대 결과**: `404 Not Found`,
`{"error":{"code":"TICKET_NOT_FOUND","message":"존재하지 않거나 삭제된 티켓입니다"}}`

## 자동 검증

수동 curl 검증은 구현 확인용 보조 수단이며, 공식 검증은
`__tests__/api/tickets.test.ts`(`npm run test -- __tests__/api/tickets.test.ts`)의
`TC-API-003-01`~`TC-API-003-06` 테스트 스위트로 수행한다. 특히 "완료된 지 24시간이
지난 티켓도 상세 조회는 성공해야 한다"(TC-API-003-02)는 DB 상태를 정밀하게 미리
세팅해야 하는 시나리오라 curl로 재현하기 어려워, 자동 테스트가 유일한 검증 수단이다.
