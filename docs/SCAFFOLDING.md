# Tika - 스캐폴딩 구조 (SCAFFOLDING.md)

> TDD(Red → Green → Refactor)로 구현을 시작하기 전, 디렉터리 구조와 설정 파일만 미리 준비해둔 결과를 정리한다.
> 컴포넌트/서비스/Route Handler 등 구현 코드와 테스트 코드는 포함하지 않으며, TEST_CASES.md 기준으로 직접 작성한다.
> 구조의 근거는 TRD.md §1.3(디렉터리 구조), CLAUDE.md(경로 별칭·코딩 컨벤션)이다.

---

## 1. 디렉터리 구조

각 디렉터리는 아직 파일이 없어 `.gitkeep`으로 git에 추적되도록 되어 있다. 실제 구현 파일이 생기면 `.gitkeep`은 지워도 된다.

```
tika/
├── app/
│   └── api/
│       └── tickets/            # Route Handler 진입점 (아직 비어있음)
├── src/
│   ├── server/
│   │   ├── services/            # 비즈니스 로직 (ticketService.ts 등)
│   │   ├── db/                  # Drizzle 스키마, 클라이언트, 쿼리
│   │   └── middleware/          # 에러 핸들링 등 공통 처리
│   ├── client/
│   │   ├── components/          # UI 컴포넌트 (PascalCase 파일명)
│   │   ├── hooks/                # 커스텀 훅
│   │   └── api/                  # API 호출 함수 (ticketApi.ts)
│   └── shared/
│       ├── types/                 # 도메인 타입 (Ticket, BoardData 등)
│       ├── validations/           # Zod 스키마
│       └── design/                # 컬러 토큰 등 디자인 상수 (colors.json 예정)
└── __tests__/
    ├── services/                  # 서비스 계층 테스트 (node 환경)
    ├── api/                       # Route Handler + ticketApi 테스트 (일부 node, 일부 jsdom)
    ├── components/                # 컴포넌트 테스트 (jsdom)
    ├── hooks/                     # 커스텀 훅 테스트 (jsdom)
    └── integration/               # US 단위 End-to-End 흐름 테스트
```

**역할 요약**

| 디렉터리 | 역할 | 비고 |
|------|------|------|
| `app/api/tickets/` | Route Handler 진입점 | `[id]/route.ts`, `reorder/route.ts` 등 하위 경로는 실제 구현 시점에 생성한다 (Next.js는 파일이 곧 라우트이므로 빈 폴더를 미리 만들 필요가 없다) |
| `src/server/services/` | 도메인 로직 (position 계산, startedAt/completedAt 처리 등) | TRD.md §4 "비즈니스 로직 위치" 규칙 |
| `src/server/db/` | Drizzle 스키마·클라이언트 | `schema.ts` 등 아직 없음 |
| `src/server/middleware/` | 공통 에러 핸들링 등 | |
| `src/client/components/` | UI 컴포넌트 | COMPONENT_SPEC.md 계층 참조 |
| `src/client/hooks/` | 커스텀 훅 (`useTickets` 등) | |
| `src/client/api/` | `ticketApi.ts` — 프론트엔드의 유일한 API 호출 경로 | TRD.md §4 "API 호출 경로" 규칙 |
| `src/shared/types/` | `Ticket`, `BoardData` 등 공유 타입 | DATA_MODEL.md §4 |
| `src/shared/validations/` | Zod 스키마 (프론트/백엔드 공통 검증) | |
| `src/shared/design/` | 컬러 토큰 등 디자인 상수 | CLAUDE.md 디자인 시스템 섹션 참조. `colors.json` 실체는 아직 생성하지 않음 |
| `__tests__/**` | TEST_CASES.md 기준 테스트 배치 위치 | 환경별 구분은 아래 §4 참조 |

---

## 2. package.json

**추가된 런타임 의존성**
- `zod` — 요청/응답 검증
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — 드래그 앤 드롭 (TRD.md §1.5)

**추가된 개발 의존성**
- `jest`, `jest-environment-jsdom` — 테스트 러너
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` — 컴포넌트 테스트
- `@types/jest`
- `dotenv` — `drizzle.config.ts`에서 `.env.local` 로드
- `tsx` — `db:seed` 스크립트 실행용

**scripts**

| 스크립트 | 명령 | 용도 |
|------|------|------|
| `test` | `jest --runInBand` | 전체 테스트 (서비스 테스트가 공유 DB를 쓰므로 순차 실행) |
| `test:components` | `jest __tests__/components __tests__/hooks __tests__/api/ticketApi.test.ts` | 컴포넌트/훅/클라이언트 API 테스트만 |
| `test:watch` | `jest --watch` | watch 모드 |
| `db:generate` | `drizzle-kit generate` | 마이그레이션 생성 |
| `db:migrate` | `drizzle-kit migrate` | 마이그레이션 실행 |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio |
| `db:seed` | `tsx src/server/db/seed.ts` | 시드 데이터 생성 (파일은 아직 없음, 구현 시점에 작성) |

---

## 3. tsconfig.json — 경로 별칭

CLAUDE.md의 경로 별칭 규칙을 반영해 기존 `"@/*": ["./*"]`를 아래로 교체했다.

```json
"paths": {
  "@/*": ["./src/*"],
  "@/app/*": ["./app/*"],
  "@/shared/*": ["./src/shared/*"],
  "@/server/*": ["./src/server/*"],
  "@/client/*": ["./src/client/*"]
}
```

| 별칭 | 실제 경로 |
|------|------|
| `@/` | `src/` |
| `@/app/` | `app/` |
| `@/shared/` | `src/shared/` |
| `@/server/` | `src/server/` |
| `@/client/` | `src/client/` |

---

## 4. 테스트 설정 (Jest)

**`jest.config.mjs`**
- `next/jest`(Next.js 공식 헬퍼)로 SWC 기반 변환, `next.config.ts`/env 자동 로드 처리
- `.ts` 대신 `.mjs`로 작성함 — Jest가 TypeScript 설정 파일을 직접 읽으려면 `ts-node`가 필요한데, 이 프로젝트에서는 불필요한 의존성이라 판단해 `.mjs`로 대체
- 기본 `testEnvironment: "jsdom"` (TRD.md §5.3: 컴포넌트/훅/클라이언트 API 테스트가 기본값)
- `moduleNameMapper`로 tsconfig 경로 별칭과 동일하게 매핑
- `setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"]`

**`jest.setup.ts`**
- `@testing-library/jest-dom` 매처 로드만 포함

**서비스/API(node 환경) 테스트**는 기본값(jsdom)을 개별 파일에서 오버라이드하는 방식이다. 파일 상단에 다음을 추가한다 (TRD.md §5.3):

```typescript
/** @jest-environment node */
```

대상: `__tests__/services/`, `__tests__/api/tickets*.test.ts`

---

## 5. DB 설정 (Drizzle)

**`drizzle.config.ts`**
```typescript
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```
- `schema: "./src/server/db/schema.ts"`는 아직 존재하지 않는 파일을 가리킨다 — DATA_MODEL.md §3의 스키마 정의를 구현 시점에 이 경로에 작성한다.

**`.env.local.example`**
```
DATABASE_URL=postgresql://user:password@localhost:5432/tika
```
- 실제 `.env.local`은 커밋하지 않는다 (`.gitignore`의 `.env*` 규칙). 예시 파일만 `!.env.local.example`로 예외 처리해 추적한다.

---

## 6. 스캐폴딩에 포함하지 않은 것

TDD 진행을 사용자가 직접 Red 단계부터 시작하기 위해 의도적으로 제외했다.

- 컴포넌트, 서비스, Route Handler, `ticketApi.ts` 등 구현 코드
- 테스트 코드 (`__tests__/` 하위는 디렉터리만 존재)
- `src/server/db/schema.ts` (Drizzle 스키마 실 코드)
- `src/shared/design/colors.json` (디자인 토큰 실 데이터)
- `app/api/tickets/[id]/`, `app/api/tickets/reorder/` 등 하위 라우트 폴더 — Next.js는 파일이 라우트를 결정하므로 `route.ts` 작성 시점에 자동으로 생긴다

---

## 7. 검증 결과

스캐폴딩 직후 다음 명령으로 정상 동작을 확인했다.

| 명령 | 결과 |
|------|------|
| `npx tsc --noEmit` | 통과 (경로 별칭 변경 후에도 기존 `app/layout.tsx`, `app/page.tsx` 영향 없음) |
| `npm run lint` | 통과 |
| `npm run test` | "No tests found" — 테스트 파일이 없는 현재 상태에서 정상 (Jest 설정 자체는 정상 작동) |

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| [TRD.md](./TRD.md) | 디렉터리 구조, 계층 경계 규칙, 테스트 환경 설정의 근거 |
| [DATA_MODEL.md](./DATA_MODEL.md) | Drizzle 스키마 정의 (`src/server/db/schema.ts` 작성 시 참조) |
| [TEST_CASES.md](./TEST_CASES.md) | TDD 시작 시 참조할 테스트 케이스 |
