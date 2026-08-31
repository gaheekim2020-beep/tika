# Tika - 데이터 모델 명세 (DATA_MODEL.md)

> 버전: 1.0 (MVP)
> ORM: Drizzle ORM + Vercel Postgres

---

## 1. ERD (Entity Relationship Diagram)

### MVP: 단일 엔티티

---

### 2차 확장 예상 ERD

---


## 2. 테이블 정의: tickets

### 칼럼 상세

| 칼럼 | 타입 | 제약조건 | 기본값 | 설명 |
|------|------|------|------|------|
| id | SERIAL | PK, auto-increment | - | 티켓 고유 식별자 |
| title | VARCHAR(200) | NOT NULL | - | 티켓 제목 |
| description | TEXT | NULLABLE | - | 티켓 상세 설명 |
| status | VARCHAR(20) | NOT NULL | 'BACKLOG' | 현재 상태 (칼럼) |
| priority | VARCHAR(10) | NOT NULL | 'MEDIUM' | 우선 순위 |
| position | INTEGER | NOT NULL | 1 | 칼럼 내 표시 순위 |
| planned_start_date | DATE | NULLABLE | NULL | 시작예정일 (사용자 입력) |
| due_date | DATE | NULLABLE | NULL | 종료예정일 (사용자 입력) |
| started_at | TIMESTAMP | NULLABLE | NULL | 시작일 (TODO 이동 시 자동 설정) |
| completed_at | TIMESTAMP | NULLABLE | NULL | 종료일 (Done 이동 시 자동 설정) |
| created_at | TIMESTAMP | NOT NULL | now() | 생성 시각 |
| updated_at | TIMESTAMP | NOT NULL | now() | 수정 시각 |

### 날짜 필드 구분
| 구분 | 필드명 | 한국어명 | 타입 | 입력 주체 | 설명 |
| ------ | ------ | ------ | ------ | ------ | ------ |
| 사용자 입력 | planned_start_date | 시작예정일 | DATE | 사용자 | 티켓 생성/수정 시 사용자가 입력 |
| 사용자 입력 | due_date | 종료예정일 | DATE | 사용자 | 티켓 생성/수정 시 사용자가 입력 |
| 시스템 자동 | started_at | 시작일 | TIMESTAMP | 시스템 | TODO로 이동 시 자동 설정(PATCH /api/tickets/reorder) |
| 시스템 자동 | completed_at | 종료일 | TIMESTAMP | 시스템 | Done으로 이동 시 자동 설정(PATCH /api/tickets/:id/complete) |

## 칼럼 제약사항

**status 허용값**: `BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`
**priority 허용값**: `LOW`, `MEDIUM`, `HIGH`

> status, priority는 PostgreSQL ENUM 타입을 사용하지 않는다.
> DB 레벨 ENUM은 값을 추가하거나 변경할 때 마이그레이션이 복잡해지므로,
> VARCHAR + 애플리케이션 레벨 검증(Zod)으로 제약한다.

### 인덱스
| 인덱스 | 칼럼 | 용도|
|------|------|------|
| idx_tickets_status_position | (status, position) | 칼럼별 정렬 조회 (보드 렌더링) |
| idx_tickets_due_date | (due_date) | 종료예정일 기준 조회 (오버듀 필터) |
| idx_tickets_completed_at | (completed_at) | Done 칼럼 24시간 필터 |

---
