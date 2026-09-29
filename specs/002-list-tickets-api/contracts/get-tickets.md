# Contract: `GET /api/tickets`

이 계약은 `docs/API_SPEC.md` §0(공통 규칙)과 §2(GET /api/tickets)을 그대로 채택한다.
아래는 구현/테스트 시 빠르게 참조하기 위한 요약이며, 최종 근거는 항상
`docs/API_SPEC.md`다 (Constitution 원칙 II).

## Request

`GET /api/tickets`

파라미터 없음.

## 처리 규칙

- 전체 티켓을 조회하여 4개 상태(`BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`)별로 그룹화
- 각 컬럼 내 `position` 오름차순 정렬
- 각 티켓에 `isOverdue` 파생 필드 포함 (`status !== 'DONE' && dueDate 존재 && dueDate < now`)
- `DONE` 컬럼은 `completedAt` 기준 24시간 이내 완료된 티켓만 포함

## Response

### 200 OK

```json
{
  "BACKLOG": [ { "...Ticket" } ],
  "TODO": [ { "...Ticket" } ],
  "IN_PROGRESS": [ { "...Ticket" } ],
  "DONE": [ { "...Ticket" } ]
}
```

각 배열 원소는 `docs/API_SPEC.md` §0의 공통 `Ticket` 스키마를 따르며 `isOverdue` 포함.
티켓이 하나도 없으면 4개 키 모두 빈 배열(`[]`)로 반환한다 (에러 아님).

### 500 Internal Server Error

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "티켓 목록을 불러오지 못했습니다" } }
```

> `POST /api/tickets`의 500 메시지("서버 오류가 발생했습니다")와 다르다 — API_SPEC.md §2가
> 이 엔드포인트 전용 메시지를 명시적으로 정의하고 있다.

## 테스트 매핑

이 계약을 검증하는 테스트 케이스는 `docs/TEST_CASES.md`의 `TC-API-002-01`~`TC-API-002-06`
(그룹화/정렬/빈 목록/24시간 필터/서버 오류)과, `isOverdue` 판정 교차 검증인
`TC-API-008-02`~`TC-API-008-05`이며, `__tests__/api/tickets.test.ts`에 구현한다
(`/** @jest-environment node */` 필수, `docs/TEST_CASES.md` §2, §8 참조).
