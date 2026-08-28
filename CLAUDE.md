# CLAUDE.md - Tika Project

# 프로젝트 개요
Tika는 티켓 기반 칸반 보드 TODO 앱이다.
Next.js App Router 기반으로, 프론트엔드와 백엔드를 디렉토리 수준에서 분리한다.
src/shared/에서 타입곽 검증 스키마를 공유한다.

> **핵심 원칙은 `.specify/memory/constitution.md` 참조**
> 이 문서는 구체적인 구현 방법과 실무 가이드를 다룬다.

## 프로젝트 구조
- app/api/      : 백엔드 진입점 (Route Handler, 요청 파싱 + 응답만)
- src/server/   : 백엔드 로직 (services, db, middleware)
- src/client/   : 프론트엔드 로직 (components, hooks, api 호출)
- src/shared/   : 공유 타입, Zod 스키마, 상수
- docs/         : 프로젝트 명세 문서

## 기술 스택
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Frontend**: React 19
- **Styling**: Tailwind CSS 4
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **ORM**: Drizzle ORM
- **DB**: PostgreSQL (로컬: node-postgres, 배포: Vercel Postgres)
- **Validation**: Zod
- **Testing**: Jest + React Testing Library
- **Deployment**: Vercel


## 명세 문서 (구현 전 필수 확인)
| 문서 | 용도 |
|------|------|
| docs/PRD.md | 제품 요구 사항 |
| docs/TRD.md | 기술 요구 사항 |
| docs/REQUIREMENTS.md | 상세 요구 사항 (FR + NFR + US ) |
| docs/API_SPEC.md | API 엔드포인트 명세 |
| docs/DATA_MODEL.md | DB 스키마, ERD, 비즈니스 규칙 |
| docs/COMPONENT_SPEC.md | 컴포넌트 계층, Props, 이벤트 |
| docs/TEST_CASES.md | TDD용 테스트 케이스 정의 |

## MCP Servers (Model Context Protocol)

### Context7 - 공식 문서 자동 참조

## 환경 설정

### 환경 변수
```bash
# .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/tika
```

### 경로 별칭
- `@/` → `src/`
- `@/app/` → `app/`
- `@/shared/` → `src/shared/`
- `@/server/` → `src/server/`
- `@/client/` → `src/client/`


## 코딩 컨벤션

### TypeScript (공통)
- strict 모드 사용
- any 사용 금지, unknown 사용 후 타입 가드
- 인터페이스는 I 접두사 없이 명사로 (예: Ticket, BoardData)
- enum 대신 const 객체 + typeof 패턴 사용
- 공유 타입은 반드시 @/shared/types에서 import

### 백엔드 (app/api/ + src/server/)
- Route Handler는 얇게: 요청 파싱 → 서비스 호출 → 응답 반환
- 비즈니스 로직은 src/server/services/에 작성
- Zod로 요청 검증 (shared/validations에서 import)
- 에러 응답 형식 통일: {error:{code, message}}
- HTTP 상태 코드: 200, 201, 400, 404, 500
- DB 쿼리는 Drizzle ORM으로만 작성 (raw SQL 금지)

### 프론트엔드 (src/client)
- 함수 컴포넌트 + 화살표 함수
- Props 타입은 컴포넌트 파일 내 정의
- API 호출은 src/client/api/ticketApi.ts를 통해서만
- 파일명: PascalCase (예: TicketCard.tsx)

## 개발 규칙

### 반드시 지켜야 할 것
- 새 기능 구현 전 TEST_CASES.md의 해상 테스트부터 작성
- API 구현 시 API_SPEC.md의 명세를 정확히 따르기
- 컴포넌트 구현 시 COMPONENT_SPEC.md의 Props와 동작 준수
- 타입 변경 시 src/shared/types 먼저 수정

### 하지 말아야 할 것
- 명세에 없는 기능 임의 추가 금지
- 테스트 코드 삭제 또는 skip 금지
- any 타입 사용 금지
- consol.log 커밋 금지 (디버깅 후 제거)
- src/client/에서 직접 DB 접근 금지
- src/server/에서 React 관련 코드 작성 금지

### 경계 규칙
- 백엔드 작입 시(app/api, src/server/) 프론트엔드(src/client/) 코드 수정 금지
- 프론트엔드 작업 시(src/client) 백엔드(app/api/, src/server/) 코드 수정 금지
- 양쪽에 영향을 주는 변경은 src/shared/ 먼저 수정 후 각각 반영

## SDD 워크플로우

### 1. 구현 전 명세 확인
```
API 구현 → API_SPEC.md 확인
컴포넌트 → COMPONENT_SPEC.md 확인
DB 작업 → DATA_MODEL.md 확인
타입 정의 → src/shared/types 확인
```

### 2. TDD 사이클
```
1. TEST_CASES.md에서 테스트 케이스 확인
2. 테스트 코드 작성 (Red) - 실패하는 테스트
3. 최소 구현 (Green) - 테스트 통과
4. 리팩토링 (Refactor) - 코드 개선
5. 명세 일치 확인
```

### 3. 구현 순서
```
1. src/shared/types - 타입 정의
2. src/shared/validations -Zod 스키마
3. __tests__/ -테스트 코드
4. src/server/services/ - 비즈니스 로직
5. app/api/ - Route Handler
6. src/client/api/ - API 호출 함수
7. src/client/components/ - UI 컴포넌트
```
## 개발 명령어

### 일반 개발
```bash
npm run dev     # 개발 서버 실행
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버 실행
npm run lint    # ESLint 실행
```

### 테스트
```bash
npm run test            # 전체 테스트 실행
npm run test:components # 컴포넌트 테스트만
npm run test:watch      # watch 모드
npx tsc --noEmit        # 타입 체크
```

#### 테스트 환경 설정
- **컴포넌트 테스트** (`__tests__/components/`, `__tests__/hooks/`, `__tests__/api/ticketApi.test.ts`): `jsdom` 환경 (기본값)
- **서비스/API 테스트** (`__tests__/services/`, `__tests__/api/tickets*.test.ts`): `node` 환경 — 파일 상단에 `/** @jest-environment node */` 필수
- **`--runInBand`**: 서비스 테스트가 공유 DB(`tika_test`)를 사용하므로 병렬 실행 시 race condition 발생. 순차 실행 필수

### 데이터베이스
```bash
npm run db:generate   # 마이그레이션 생성
npm run db:migrate    # 마이그레이션 실행
npm run db:studio     # Drizzle Studio 실행
npm run db:seed       # 시드 데이터 생성
```

### Git Hooks
```bash
bash .specify/scripts/bash/install-hooks.sh   # hook 설치
rm .git/hooks/pre-commit                      # hook 제거
```

- **pre-commit**: 커밋 시 CHANGELOG.md 자동 업데이트
- `/changelog` 수동 실행 시에는 hook이 자동 스킵됨 (중복 방지)

## 검증 체크리스트

### 커밋 전
- [] `npx tsc --noEmit` 타입 체크 통과
- [] `npx run test` 모든 테스트 통과
- [] `npx run build` 빌드 성공
- [] console.log 제거 확인
- [] .env 파일 미포함 확인

## PR 전
- [] 명세 문서와 일치 확인
- [] 테스트 커버리지 충분
- [] 레이어 분리 준수 (Route Handler vs Service)
- [] Zod 검증 누락 없음
- [] 에러 응답 형식 일치

## 금지 사항

### 절대 하지 말 것
- ❌ any 타입 사용
- ❌ 명세 없는 기능 추가
- ❌ 테스트 삭제 또는 `.skip()`
- ❌ console.log 커밋
- ❌ .env 파일 커밋
- ❌ src/client/에서 DB 직접 접근
- ❌ Route Handler에 비즈니스 로직 작성
- ❌ **공식 문서 확인 없이 추축으로 구현** (특히 Claude Code 기능/구조)

### 확인 필요 
- ⚠️ DB 스키마 변경 → 마이그레이션 생성
- ⚠️ shared 타입 변경 → 영향 범위 확인
- ⚠️ API 응답 형식 변경 → API_SPEC.md 먼저 수정
- ⚠️ 패키지 추가/업그레이드 → 호환성 확인
- ⚠️ Claude Code 기능 사용 → https://code.claude.com/docs 먼저 확인
- ⚠️ 프레임워크/라이브러리 기능 → 최신 공식 문서 확인

## 문제 해결

### 타입 에러
```bash
  #타입 체크
  npx tsc --noEmit

  # 캐시 삭제 후 재시도
  rm -rf .next
  npm run build
```
### 테스트 실패
```bash
# 단일 테스트 실행
npm run test -- path/to/test.test.ts

# 상세로그
npm run test -- --verbose
```

### 서비스 테스트 실패 (DB 관련)
```bash
# 원인 1: @jest-environment node 주석 누락
# → 서비스 테스트 파일 상단에 /** @jest-environment node */ 추가

# 원인 2: 병렬 실행으로 DB 데이터 충돌
# → --runInBand 플래그 사용 (package.json에 설정됨)

# 원인 3: DB 연결 실패
pg_isready # PostgreSQL 상태 확인
psql $DATABASE_URL -c "SELECT 1"
```

### DB 연결 오류
```bash
# 환경 변수 확인
echo $DATABASE_URL

# DB 상태 확인
psql $DATABASE_URL -c "SELECT 1"
```

## Git 워크플로우

### 커밋 메시지
```bash
feat: 티켓 생성 API 구현
fix: 티켓 삭제 시 404 에러 수정
refactor: ticketService 로직 분리
test: 티켓 목록 조회 테스트 추가
docs: API_SPEC.md 에러 코드 추가
```

### 작성자 접두사
- `[CL]`: Claude Code가 작성/커밋
- `[GK]`: 사용자(GK)가 직접 작성/커밋
- 접두사는 커밋 메시지 타입 앞에 붙인다. 예: `[CL] docs: PRD.md 작성`

### 브랜치 전략
- `main`: 프로덕션
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정

## 디자인 시스템
스타일링 작업 시 반드시 아래 파일들을 참조할 것:
- 컬러 토큰 (참조): `src/shared/design/colors.json`
- 디자인 가이드: `docs/DESIGN_SYSTEM.md`
- CSS 변수 (런타임): `app/globals.css` `:root`

새 컴포넌트 생성 시 colors.json의 semantic 컬러와
DESIGN_SYSTEM.md의 간격/그림자/라운딩 규칙을 따른다.
컬러 변경 시 colors.json과 globals.css의 CSS 변수를 함께 업데이트한다.


---