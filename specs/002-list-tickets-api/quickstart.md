# Quickstart: 티켓 목록 조회 API 수동 검증

## 사전 조건

- 로컬 PostgreSQL이 실행 중이고 `.env.local`의 `DATABASE_URL`이 유효할 것
- 마이그레이션이 적용되어 있을 것 (`tickets` 테이블 존재 확인 완료, 이번 기능은 추가
  마이그레이션 없음)
- 개발 서버 실행: `npm run dev`
- 아래 시나리오는 `POST /api/tickets`(이미 구현됨)로 먼저 데이터를 만든 뒤 확인한다

## 정상 케이스 — 빈 목록 조회

사전에 아무 티켓도 만들지 않은 상태에서:

```bash
curl http://localhost:3000/api/tickets
```

**기대 결과**: `200 OK`, `{"BACKLOG":[],"TODO":[],"IN_PROGRESS":[],"DONE":[]}`

## 정상 케이스 — 생성 후 그룹화 확인

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"조회 확인용 티켓"}'

curl http://localhost:3000/api/tickets
```

**기대 결과**: 두 번째 응답의 `BACKLOG` 배열에 방금 생성한 티켓이 포함됨.

## 정상 케이스 — 오버듀 표시 확인

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"내일 마감 티켓","dueDate":"2026-10-01"}'

curl http://localhost:3000/api/tickets
```

**기대 결과**: 응답의 해당 티켓 `isOverdue`는 `dueDate`가 아직 지나지 않았으므로 `false`.
(과거 `dueDate`로 오버듀 상태를 재현하려면 DB에서 직접 `dueDate`를 과거로 갱신하거나,
자동 테스트(`TC-API-008-02~05`)로 확인한다 — `dueDate`는 생성 시 과거 날짜를 거부하므로
curl만으로는 과거 `dueDate`를 가진 티켓을 만들 수 없다.)

## 자동 검증

수동 curl 검증은 구현 확인용 보조 수단이며, 공식 검증은
`__tests__/api/tickets.test.ts`(`npm run test -- __tests__/api/tickets.test.ts`)의
`TC-API-002-*`, `TC-API-008-02~05` 테스트 스위트로 수행한다. 특히 그룹화/정렬/24시간 필터/
서버 오류 시나리오는 curl로 재현하기 어렵거나 불가능해(DB 상태를 정밀하게 미리 세팅해야
함) 자동 테스트가 유일한 검증 수단이다.
