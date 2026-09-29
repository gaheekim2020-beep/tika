# Quickstart: 티켓 생성 API 수동 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것: `npm run db:migrate` (이미 적용됨, `tickets` 테이블 존재 확인 완료)
- 개발 서버 실행: `npm run dev`

## 정상 케이스 — 제목만으로 생성

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"로그인 페이지 구현"}'
```

**기대 결과**: `201 Created`, `status: "BACKLOG"`, `priority: "MEDIUM"`, `position: 1024`
(칼럼이 비어 있었을 경우).

## 정상 케이스 — 상세 정보 포함

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API 설계 문서 작성",
    "description": "엔드포인트 정의 및 에러 코드 정리",
    "priority": "HIGH",
    "dueDate": "2026-10-01"
  }'
```

**기대 결과**: `201 Created`, 입력한 필드가 응답에 그대로 반영됨.

## 예외 케이스 — 제목 누락

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":""}'
```

**기대 결과**: `400 Bad Request`,
`{"error":{"code":"VALIDATION_ERROR","field":"title","message":"제목을 입력해주세요"}}`.

## 예외 케이스 — 과거 종료예정일

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","dueDate":"2020-01-01"}'
```

**기대 결과**: `400 Bad Request`,
`field: "dueDate"`, `message: "종료예정일은 오늘 이후 날짜를 선택해주세요"`.

## 자동 검증

수동 curl 검증은 구현 확인용 보조 수단이며, 공식 검증은
`__tests__/api/tickets.test.ts`(`npm run test -- __tests__/api/tickets.test.ts`)의
`TC-API-001-*` 테스트 스위트로 수행한다.
