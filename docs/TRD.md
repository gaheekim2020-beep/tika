# Tika - 기술 요구사항 명세 (TRD.md)

> Technical Requirements Document
> 제품 요구사항은 [PRD.md](./PRD.md), 상세 기능/비기능 요구사항은 [REQUIREMENTS.md](./REQUIREMENTS.md) 참조.
> 핵심 원칙은 `.specify/memory/constitution.md` 참조.

---

## 1. 시스템 아키텍처

### 1.1 전체 구조

Tika는 **Vercel 단일 배포** 구조를 사용한다. 프론트엔드와 백엔드를 별도 서버로 분리하지 않고, Next.js App Router 하나의 애플리케이션 안에서 디렉터리 수준으로만 분리한다.

- **프론트엔드**: Next.js App Router (React 19) — 브라우저에서 렌더링/조작되는 UI
- **백엔드**: Next.js Route Handler (`app/api/`) — Vercel Serverless Functions로 배포되는 API 엔드포인트
- **데이터베이스**: Vercel Postgres (Neon 기반) — 서버리스 커넥션 풀을 자동 관리하는 관계형 DB

단일 리포지토리·단일 배포 파이프라인으로 운영하여, 개인 프로젝트 규모에서 인프라 관리 비용을 최소화한다.

### 1.2 아키텍처 다이어그램

요청은 다음 흐름을 따라 계층을 통과한다. 각 계층은 자신의 바로 아래 계층만 호출하며, 계층을 건너뛰지 않는다.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│  src/client/components/  →  src/client/hooks/                    │
│         │                                                        │
│         ▼                                                        │
│  src/client/api/ticketApi.ts  (fetch 래퍼)                        │
└─────────────────────────┬─────────────────────────────────────────┘
                           │ HTTP (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                Vercel Serverless Function (Next.js)               │
│                                                                    │
│  app/api/tickets/route.ts        (Route Handler)                  │
│    - 요청 파싱 (params, body)                                     │
│    - Zod 스키마 검증 (src/shared/validations)                     │
│    - 서비스 호출                                                  │
│    - 응답 반환 (status + JSON)                                    │
│         │                                                          │
│         ▼                                                          │
│  src/server/services/ticketService.ts   (비즈니스 로직)            │
│    - position 재계산, Overdue 판정, startedAt/completedAt 처리     │
│         │                                                          │
│         ▼                                                          │
│  src/server/db/  (Drizzle ORM 쿼리)                                │
└─────────────────────────┬───────────────────────────────────────┘
                           │ SQL (node-postgres / Vercel Postgres 드라이버)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL (로컬: node-postgres / 배포: Vercel Postgres)│
└─────────────────────────────────────────────────────────────────┘
```

- `src/shared/`(타입, Zod 스키마, 상수)는 프론트엔드와 백엔드 양쪽에서 공통 참조한다.
- Route Handler는 얇게 유지하며, 실질적인 비즈니스 로직은 반드시 Service 계층에 위치한다 (4절 참조).

### 1.3 디렉터리 구조

```
tika/
├── app/
│   └── api/                    # 백엔드 진입점 (Route Handler)
│       └── tickets/
│           ├── route.ts        # GET, POST /api/tickets
│           ├── [id]/route.ts   # GET, PATCH, DELETE /api/tickets/:id
│           ├── [id]/complete/route.ts   # PATCH /api/tickets/:id/complete
│           └── reorder/route.ts         # PATCH /api/tickets/reorder
├── src/
│   ├── server/                 # 백엔드 로직
│   │   ├── services/           # 비즈니스 로직 (ticketService.ts 등)
│   │   ├── db/                 # Drizzle 스키마, 클라이언트, 쿼리
│   │   └── middleware/         # 에러 핸들링 등 공통 처리
│   ├── client/                 # 프론트엔드 로직
│   │   ├── components/         # UI 컴포넌트 (PascalCase 파일명)
│   │   ├── hooks/               # 커스텀 훅
│   │   └── api/                 # API 호출 함수 (ticketApi.ts)
│   └── shared/                  # 공유 타입/검증/상수
│       ├── types/                # 도메인 타입 (Ticket, BoardData 등)
│       ├── validations/          # Zod 스키마
│       └── design/               # 컬러 토큰 등 디자인 상수
└── docs/                        # 프로젝트 명세 문서
```

경로 별칭: `@/` → `src/`, `@/app/` → `app/`, `@/shared/` → `src/shared/`, `@/server/` → `src/server/`, `@/client/` → `src/client/`

---

## 2. 기술 스택 상세

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js | 16.3.1 (App Router) |
| Runtime | Node.js (Vercel Serverless Functions) | Vercel 기본 Node.js LTS |
| Language | TypeScript | 5.x (strict mode) |
| Frontend | React | 19 |
| Styling | Tailwind CSS | 4 |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable | 최신 stable |
| ORM | Drizzle ORM | 최신 stable |
| DB | PostgreSQL (로컬: node-postgres / 배포: Vercel Postgres) | PostgreSQL 15+ |
| Validation | Zod | 최신 stable |
| Testing | Jest + React Testing Library | 최신 stable |
| Deployment | Vercel | - |

### 2.1 Framework: Next.js 16.3.1 (App Router)

**선정 이유**
- 프론트엔드와 백엔드를 하나의 애플리케이션·하나의 배포 단위로 운용할 수 있어, 개인 프로젝트 규모에서 별도 백엔드 서버(Express 등)를 구축·배포·유지보수할 필요가 없다.
- App Router의 Route Handler(`app/api/`)가 REST API 엔드포인트 역할을 그대로 수행하므로 API_SPEC.md의 엔드포인트를 파일 기반 라우팅으로 직관적으로 매핑할 수 있다.
- Vercel과 네이티브로 통합되어 있어 배포 설정이 거의 필요 없다.

**대안 비교**

| 대안 | 장점 | 단점 | 미채택 사유 |
|------|------|------|--------------|
| Next.js Pages Router | 안정적, 자료 많음 | App Router 대비 서버 컴포넌트/레이아웃 기능 부재, 최신 기능 지원 우선순위 낮음 | 신규 프로젝트에서 구세대 라우터를 채택할 이유 없음 |
| 별도 백엔드(Express/Nest) + SPA(Vite React) | 프론트/백엔드 완전 독립 배포·스케일링 | 배포 파이프라인 2개, 인프라 관리 비용 증가, 개인 프로젝트 규모엔 과함 | MVP 규모 대비 오버엔지니어링 |
| Remix | 유사한 풀스택 모델 | Vercel Postgres/생태계 통합이 Next.js 대비 부족, 팀 학습 곡선 | Vercel 배포 최적화 측면에서 Next.js가 우위 |

### 2.2 Runtime: Node.js (Vercel Serverless Functions)

**선정 이유**
- Next.js Route Handler는 기본적으로 Vercel Serverless Functions(Node.js runtime)로 배포되어, 별도 서버 프로세스 관리 없이 요청 단위로 자동 스케일링된다.
- Drizzle ORM, node-postgres 등 DB 드라이버가 Node.js 런타임을 전제로 하므로 Edge Runtime보다 Node.js Runtime이 호환성이 높다.

**대안 비교**

| 대안 | 장점 | 단점 | 미채택 사유 |
|------|------|------|--------------|
| Vercel Edge Runtime | 콜드스타트 짧음, 지리적 분산 | 일부 Node API·DB 드라이버 미지원, PostgreSQL TCP 커넥션 제약 | ORM/DB 드라이버 호환성 문제로 부적합 |

### 2.3 ORM: Drizzle ORM

**선정 이유**
- Vercel Postgres가 공식적으로 지원하는 ORM 중 하나로, `@vercel/postgres` 드라이버와 통합이 검증되어 있다.
- 스키마를 TypeScript 코드로 정의하고 타입이 자동으로 추론되어, 별도의 코드 생성(generate) 단계 없이 즉시 타입 안전한 쿼리를 작성할 수 있다.
- Query Builder가 SQL과 유사한 문법을 사용해 러닝 커브가 낮고, raw SQL 없이도 명시적인 쿼리 작성이 가능하다 (CLAUDE.md 원칙: "DB 쿼리는 Drizzle ORM으로만 작성, raw SQL 금지").

**대안 비교: Drizzle vs Prisma**

| 항목 | Drizzle ORM | Prisma |
|------|-------------|--------|
| 코드 생성 | 불필요 (스키마 = TypeScript 코드) | 필요 (`prisma generate`로 클라이언트 생성, 빌드 단계 추가) |
| 서버리스 콜드스타트 | 가볍고 빠름 (드라이버 직접 사용) | Prisma Client 초기화 오버헤드 존재 |
| 쿼리 방식 | SQL-like Query Builder (SQL 이해도 요구) | 자체 API 추상화 (SQL 지식 없이도 사용 가능) |
| Vercel Postgres 통합 | 공식 지원, 레퍼런스 풍부 | 별도 어댑터 필요 |
| 마이그레이션 | `drizzle-kit`으로 경량 관리 | Prisma Migrate (기능은 풍부하나 무거움) |

**결론**: 서버리스 환경에서의 콜드스타트 최소화, 코드 생성 단계 제거, Vercel Postgres 공식 지원이라는 세 가지 이유로 Drizzle ORM을 채택한다.

### 2.4 DB: Vercel Postgres (Neon 기반)

**선정 이유**
- Neon 엔진 기반으로 서버리스 환경에 최적화된 커넥션 풀링을 자동으로 관리하여, Serverless Functions가 요청마다 새 커넥션을 맺어도 DB 커넥션 고갈 문제가 발생하지 않는다.
- Vercel Dashboard에서 프로비저닝·환경 변수 연결이 통합되어 있어 별도 DB 호스팅 설정이 불필요하다.
- 로컬 개발 시 동일한 PostgreSQL 프로토콜(node-postgres)을 사용해 로컬/배포 환경 간 쿼리 동작 차이가 없다.

**대안 비교**

| 대안 | 장점 | 단점 | 미채택 사유 |
|------|------|------|--------------|
| 자체 관리 PostgreSQL (RDS 등) | 완전한 제어권 | 프로비저닝·커넥션 풀링·백업을 직접 관리해야 함 | 개인 프로젝트 규모에서 운영 부담 과다 |
| PlanetScale (MySQL) | 서버리스 최적화, 브랜칭 기능 | PostgreSQL 대비 관계형 제약(FK) 지원 제한적 시기 존재, Vercel Postgres만큼 네이티브 통합 아님 | PostgreSQL 기반 요구사항 및 Vercel 네이티브 통합 우위로 미채택 |
| Supabase | Postgres 기반, 부가 기능(Auth 등) 풍부 | MVP는 인증 등 부가 기능 불필요, Vercel 배포와의 통합 밀도가 상대적으로 낮음 | 불필요한 기능 대비 Vercel Postgres가 배포 파이프라인과 더 밀접 |

---

## 3. 데이터 흐름

### 3.1 읽기 흐름 (조회)

```
컴포넌트 (src/client/components/)
   → useTickets 등 커스텀 훅 (src/client/hooks/)
   → ticketApi.ts  (src/client/api/ticketApi.ts) — fetch("/api/tickets")
   → GET /api/tickets  (app/api/tickets/route.ts)
   → ticketService.getBoard()  (src/server/services/ticketService.ts)
   → Drizzle 쿼리  (src/server/db/)
   → PostgreSQL
   ← 4개 컬럼 그룹화 + position 정렬 + isOverdue 파생 필드 포함 응답
```

- Route Handler는 요청을 그대로 서비스에 위임하고, 서비스가 반환한 결과를 JSON으로 직렬화해 응답한다.
- `isOverdue`는 DB에 저장되지 않고 서비스 계층에서 조회 시점에 동적으로 계산한다 (FR-008).

### 3.2 쓰기 흐름 (생성/수정)

```
폼 컴포넌트 (src/client/components/)
   → Zod 스키마로 클라이언트 사이드 1차 검증 (src/shared/validations)
   → ticketApi.ts — fetch("/api/tickets", { method: "POST", body })
   → POST /api/tickets  (app/api/tickets/route.ts)
   → Zod 스키마로 서버 사이드 2차 검증 (동일 스키마, src/shared/validations)
   → ticketService.createTicket()
   → Drizzle 쿼리 (INSERT)
   → PostgreSQL
   ← 생성된 티켓 전체 데이터 응답 (201 Created)
```

- 동일한 Zod 스키마를 `src/shared/validations`에서 프론트/백엔드가 함께 import하여 이중 검증한다 (NFR-004). 프론트엔드 검증은 UX 개선용이며, 최종 신뢰 경계는 서버 사이드 검증이다.
- 검증 실패 시 Route Handler는 400 Bad Request와 통일된 에러 형식(`{error:{code, message}}`)을 반환한다.

### 3.3 드래그 앤 드롭 흐름 (상태/순서 변경)

```
카드 드래그 종료 (@dnd-kit onDragEnd)
   → 클라이언트 상태 낙관적 업데이트 (UI 즉시 반영, 새 칼럼/순서로 렌더)
   → ticketApi.ts — fetch("/api/tickets/reorder", { method: "PATCH", body })
   → PATCH /api/tickets/reorder  (app/api/tickets/reorder/route.ts)
   → ticketService.reorderTicket()
        - position 재계산: 인접 카드 사이 삽입 시 (prev + next) / 2
        - 간격 1 미만 시 해당 칼럼 전체 1024 간격으로 재정렬
        - TODO 진입 시 startedAt 기록 / BACKLOG 복귀 시 startedAt 초기화
        - 트랜잭션으로 status·position 동시 반영 (원자성 보장)
   → Drizzle 트랜잭션 (UPDATE)
   → PostgreSQL
   ← 성공(200): 낙관적 업데이트 확정
   ← 실패: 클라이언트가 드래그 이전 상태로 롤백
```

- Done 컬럼으로의 이동은 이 API가 아닌 `PATCH /api/tickets/:id/complete`(FR-005)를 별도로 사용한다.
- 낙관적 업데이트 실패 시 롤백 처리는 클라이언트 훅(`src/client/hooks/`)에서 담당한다 (NFR-004).

---

## 4. 계층 간 경계 규칙

계층 분리는 CLAUDE.md의 "경계 규칙"을 기술적으로 강제하기 위한 것이며, 코드 리뷰 및 정적 분석(ESLint import 제한 등)으로 검증한다.

| 규칙 | 내용 |
|------|------|
| 단방향 참조 | `src/server/`와 `src/client/`는 서로를 import할 수 없다. 백엔드 코드가 React를 알아서도 안 되고, 프론트엔드 코드가 DB/서비스 로직을 알아서도 안 된다. |
| 공유 계층 | `src/shared/`(types, validations, constants)만 양쪽에서 참조 가능하다. 타입/스키마가 변경되면 반드시 `src/shared/`를 먼저 수정한 뒤 각 계층에 반영한다. |
| Route Handler는 얇게 | `app/api/`의 Route Handler는 (1) 요청 파싱(params, body, query), (2) 서비스 호출, (3) 응답 반환만 수행한다. 비즈니스 로직(검증 외 조건 분기, position 계산, 날짜 처리 등)을 Route Handler에 직접 작성하지 않는다. |
| 비즈니스 로직 위치 | 모든 도메인 로직은 `src/server/services/`에 위치한다. Route Handler는 서비스 함수를 호출하는 것 외의 로직을 갖지 않는다. |
| DB 접근 경로 | `src/client/`에서 직접 DB에 접근하지 않는다. 모든 DB 접근은 `src/server/db/` → Drizzle ORM을 통해서만 이루어진다. |
| API 호출 경로 | 프론트엔드의 모든 API 호출은 `src/client/api/ticketApi.ts`를 통해서만 이루어진다. 컴포넌트에서 직접 `fetch`를 호출하지 않는다. |
| Raw SQL 금지 | DB 쿼리는 Drizzle ORM으로만 작성하며 raw SQL을 사용하지 않는다. |

---

## 5. 개발 환경 설정

### 5.1 로컬 DB 설정

```bash
# Vercel 프로젝트와 연결된 환경 변수를 로컬로 가져온다
vercel env pull .env.local
```

- `.env.local`에 `DATABASE_URL`(Vercel Postgres 접속 정보)이 자동으로 채워진다.
- 로컬 개발 시에는 `node-postgres` 드라이버로 동일한 `DATABASE_URL`에 접속하며, 배포 환경과 쿼리 동작이 동일하다.
- `.env.local`은 `.gitignore`에 포함되어 커밋되지 않는다 (CLAUDE.md: `.env` 파일 커밋 금지).

### 5.2 마이그레이션 및 시드

```bash
npm run db:generate   # 스키마 변경분으로 마이그레이션 생성 (drizzle-kit)
npm run db:migrate    # 마이그레이션 실행
npm run db:studio     # Drizzle Studio로 DB 데이터 확인
npm run db:seed       # 개발용 시드 데이터 생성
```

### 5.3 테스트: Jest + React Testing Library

- **컴포넌트/훅/클라이언트 API 테스트** (`__tests__/components/`, `__tests__/hooks/`, `__tests__/api/ticketApi.test.ts`): `jsdom` 환경(기본값) 사용.
- **서비스/서버 API 테스트** (`__tests__/services/`, `__tests__/api/tickets*.test.ts`): `node` 환경 사용 — 파일 상단에 `/** @jest-environment node */` 명시 필수.
- 서비스 테스트는 공유 테스트 DB(`tika_test`)를 사용하므로 `--runInBand`로 순차 실행하여 race condition을 방지한다.
- TDD 사이클을 따른다: TEST_CASES.md의 테스트 케이스 확인 → 실패하는 테스트 작성(Red) → 최소 구현(Green) → 리팩토링(Refactor).

```bash
npm run test              # 전체 테스트
npm run test:components   # 컴포넌트 테스트만
npm run test:watch        # watch 모드
npx tsc --noEmit          # 타입 체크
```

### 5.4 Lint: ESLint + Prettier

- ESLint(`eslint-config-next` 기반)로 코드 스타일 및 잠재적 오류를 정적 검사한다.
- Prettier로 포맷팅을 통일하며, ESLint와 충돌하지 않도록 `eslint-config-prettier`를 함께 사용한다.
- strict TypeScript 모드와 결합하여 `any` 사용, 미사용 변수 등을 커밋 전 단계에서 차단한다.

```bash
npm run lint         # ESLint 실행
```

---

## 6. 배포 전략

| 트리거 | 대상 | 동작 |
|--------|------|------|
| `main` 브랜치 push | 프로덕션 배포 | Vercel이 자동으로 빌드·배포. 별도 CI/CD 파이프라인 구성 없이 git push만으로 배포 완료 |
| PR 생성 | Preview 배포 | PR별로 격리된 Preview URL이 자동 생성되어, 머지 전 실제 배포 환경에서 리뷰·QA 가능 |
| 환경 변수 | Vercel Dashboard | `DATABASE_URL` 등 환경 변수는 Vercel Dashboard의 Environment Variables에서 관리하며, Production/Preview/Development 스코프를 구분하여 설정한다. 로컬에는 `vercel env pull`로 동기화한다 |

- HTTPS는 Vercel이 기본으로 제공하며 별도 인증서 관리가 불필요하다.
- 프로덕션 배포 전 로컬에서 `npx tsc --noEmit`, `npm run test`, `npm run build`가 모두 통과해야 한다 (CLAUDE.md 커밋 전 체크리스트).
- DB 스키마 변경이 포함된 배포는 마이그레이션(`npm run db:migrate`)을 배포 전/후 절차에 맞춰 별도로 실행한다 (Vercel 빌드 단계에는 자동 마이그레이션을 포함하지 않는다).

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| [PRD.md](./PRD.md) | 제품 요구사항 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 상세 요구사항 (FR + NFR + US) |
| API_SPEC.md | API 엔드포인트 명세 |
| DATA_MODEL.md | DB 스키마, ERD, 비즈니스 규칙 |
| COMPONENT_SPEC.md | 컴포넌트 계층, Props, 이벤트 |
| TEST_CASES.md | TDD용 테스트 케이스 정의 |
