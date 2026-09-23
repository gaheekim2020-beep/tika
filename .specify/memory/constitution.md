<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: N/A
- Added sections:
  - (1.0.0) Core Principles: I. TypeScript Strict Mode, II. API 응답 명세 준수, III. 표준 에러 응답 형식,
    IV. Zod 기반 요청 검증, V. 서비스 레이어 분리
  - (1.0.0) Governance
  - (1.1.0) 🚨 Guardrails (절대 준수 사항): AI 코딩 에이전트의 DB/Git/패키지/파일시스템
    파괴적 명령 금지 및 사용자 확인 규칙 (사용자가 직접 초안 작성, "절대 금지"/"사용자 확인
    필요"로 재구성하고 독립 섹션으로 분리)
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ no changes required (Constitution Check gate reads this file at runtime)
  - .specify/templates/spec-template.md: ✅ no changes required
  - .specify/templates/tasks-template.md: ✅ no changes required
  - .specify/templates/checklist-template.md: ✅ no changes required
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): 원 제정일이 별도로 기록되어 있지 않아 이 amendment 작성일로 설정함. 실제 최초 합의일이 다르면 수정 필요.
  - "메이저 버전 자동 업그레이드 — 절대 금지"(Guardrails)가 CLAUDE.md의 "패키지 추가/업그레이드
    → 호환성 확인"(확인 필요 수준)보다 엄격함 — 의도적 강화인지 확인 필요.
-->

# Tika Constitution

## Core Principles

### I. TypeScript Strict Mode
모든 TypeScript 코드는 `strict` 모드로 작성해야 한다 (`tsconfig.json`의 `strict: true`).
`any` 타입 사용을 금지하며, 타입이 불확실한 값은 `unknown`으로 받은 뒤 타입 가드로 좁혀야
한다. `enum` 대신 `as const` 객체 + `typeof` 패턴을 사용한다. 프론트엔드와 백엔드가 공유하는
타입은 반드시 `src/shared/types`에서 정의하고 그곳에서만 import한다.

**Rationale**: 단일 사용자 프로덕션 앱인 Tika는 런타임 타입 오류가 곧 사용자에게 노출되는
버그로 이어진다. strict 모드와 `any` 금지는 컴파일 타임에 오류를 잡아내기 위한 최소한의
안전장치이며, `src/shared/types` 단일 진실 공급원은 프론트/백엔드 계약이 어긋나는 것을
구조적으로 방지한다.

### II. API 응답 명세 준수
모든 API 엔드포인트의 요청/응답 필드, HTTP 상태 코드(200/201/400/404/500)는
`docs/API_SPEC.md`에 정의된 형식을 정확히 따라야 한다. API 동작을 변경할 때는 코드보다
`docs/API_SPEC.md`를 먼저 수정하고, 이후 구현을 명세에 맞춘다. 명세에 없는 필드나
엔드포인트를 임의로 추가하지 않는다.

**Rationale**: `src/shared/types`의 API 계약 타입과 `docs/API_SPEC.md`는 프론트엔드
(`src/client`)가 백엔드 구현 세부사항 없이 동작을 예측할 수 있게 하는 유일한 근거다.
명세와 구현이 어긋나면 두 레이어가 독립적으로 개발/테스트될 수 없다.

### III. 표준 에러 응답 형식
모든 API 에러 응답은 `{ error: { code, message } }` 형식을 예외 없이 따른다. Route
Handler와 서비스 레이어는 이 형식 밖의 에러 구조(문자열만 반환, 필드명 변경 등)를 반환해서는
안 된다.

**Rationale**: 프론트엔드의 에러 처리 로직(`src/client/api`)이 단일 형식만 파싱하면 되도록
보장해, 엔드포인트마다 다른 에러 파싱 분기를 만들 필요를 없앤다.

### IV. Zod 기반 요청 검증
모든 API 요청(body, query, params)은 Zod 스키마로 검증한다. 검증 스키마는
`src/shared/validations`에 정의하고 Route Handler에서 import해서 사용한다. 검증되지 않은
입력이 서비스 레이어(`src/server/services`)에 도달해서는 안 된다.

**Rationale**: 요청 검증을 서비스 레이어 이전에 강제하면, 비즈니스 로직은 이미 타입이
보장된 입력만 다루면 되어 방어적 코드가 줄어든다. `src/shared/validations`에 모아두면
Zod 스키마에서 TypeScript 타입을 `z.infer`로 파생시켜 검증 로직과 타입 정의가 어긋날
여지를 없앤다.

### V. 서비스 레이어 분리
비즈니스 로직은 반드시 `src/server/services/`에 작성한다. `app/api/`의 Route Handler는
요청 파싱 → 서비스 호출 → 응답 반환만 수행하는 얇은 계층으로 유지하며, 그 안에 비즈니스
로직을 직접 작성하지 않는다. DB 쿼리는 Drizzle ORM으로만 작성하고 raw SQL을 사용하지
않는다.

**Rationale**: Route Handler에 로직이 섞이면 HTTP 계층과 비즈니스 규칙이 얽혀 단위 테스트가
어려워지고, TDD 사이클(`docs/TEST_CASES.md` 기반)에서 서비스 로직만 독립적으로 검증하기
힘들어진다. 레이어 분리는 `__tests__/services`와 `__tests__/api`를 서로 다른 관심사로
테스트할 수 있게 한다.

## 기술 표준

- **런타임/프레임워크**: Next.js (App Router), React, TypeScript. 상세 버전과 스택 목록은
  `CLAUDE.md`의 "기술 스택" 섹션과 `docs/TRD.md`를 단일 진실 공급원으로 한다 — 이 문서에
  버전 번호를 중복 기재하지 않는다.
- **데이터베이스**: PostgreSQL. 스키마와 마이그레이션은 `src/server/db/schema.ts`에서
  Drizzle ORM으로 정의하며, DB 관련 비즈니스 규칙(상태 전이, position 계산 등)은
  `docs/DATA_MODEL.md`를 근거로 한다.
- **디렉토리 경계**: `app/api/`, `src/server/`는 백엔드 전용이며 React 관련 코드를 포함하지
  않는다. `src/client/`는 프론트엔드 전용이며 DB에 직접 접근하지 않는다. 양쪽에 걸친 변경은
  `src/shared/`를 먼저 수정한 뒤 각 레이어에 반영한다.

## 개발 워크플로우

- **SDD**: 구현 전 관련 명세 문서(`docs/API_SPEC.md`, `docs/COMPONENT_SPEC.md`,
  `docs/DATA_MODEL.md`)를 먼저 확인하거나 작성한다. 명세 없이 구현을 시작하지 않는다.
- **TDD**: `docs/TEST_CASES.md`의 테스트 케이스를 기준으로 실패하는 테스트를 먼저 작성한
  뒤(Red), 테스트를 통과시키는 최소 구현을 하고(Green), 통과 상태를 유지하며 리팩터링한다
  (Refactor). 테스트 코드 삭제나 `.skip()` 처리는 금지한다.
- **품질 게이트**: 커밋 전 `npx tsc --noEmit`, `npm run test`, `npm run build`가 모두
  통과해야 한다. PR 전에는 명세 문서와의 일치, 레이어 분리 준수, 본 Constitution의 원칙
  (특히 II~V) 위반 여부를 검토한다.

## 🚨 Guardrails (절대 준수 사항)

AI 코딩 에이전트가 실수로 위험한 작업을 수행하지 않도록 명시적으로 금지하는 규칙들이다.
아래 "절대 금지" 항목은 어떤 상황에서도 위반할 수 없다. "사용자 확인 필요" 항목은 금지가
아니라, 실행 전 반드시 사용자 승인을 받아야 하는 항목이다.

### 절대 금지
- **데이터베이스**: `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, WHERE 절 없는
  `DELETE FROM`, 운영 DB 자동 변경
- **Git**: `git push --force`, `git reset --hard`, `git branch -D`(main/master)
- **패키지 관리**: `npm audit fix --force`, 메이저 버전 자동 업그레이드
- **파일 시스템**: `rm -rf /` 또는 루트 경로 삭제, 프로젝트 외부 파일 수정,
  `src/` 디렉토리 전체 삭제

### 사용자 확인 필요
- **데이터베이스**: `ALTER TABLE DROP COLUMN`, 삭제/리셋 작업 전반 (삭제 전 백업 또는
  복구 방법을 먼저 안내한다. 테스트 데이터가 있는 경우 DB 리셋 대신 SQL로 해결한다)
- **Git**: `git clean -fd`
- **패키지 관리**: `rm -rf node_modules && npm install`
- **파일 시스템**: `.env` 파일 삭제

### 안전 작업 원칙
- 파괴적 작업(삭제, 초기화) 전 반드시 사용자 확인
- 복구 불가능한 작업은 백업 방법 먼저 안내
- 자동화된 스크립트의 파괴적 명령 실행 금지
- 의심스러운 작업은 실행 전 사용자에게 설명 및 확인

## Governance

이 Constitution은 `CLAUDE.md`와 `docs/` 하위 명세 문서보다 상위의 규범이며, 상충하는 내용이
있을 경우 이 문서가 우선한다. `CLAUDE.md`는 이 Constitution이 정한 원칙을 실무에서 적용하는
구체적 가이드(명령어, 컨벤션 세부사항)를 다룬다.

**개정 절차**: Constitution 변경은 `.specify/memory/constitution.md`를 직접 수정하고,
변경 사유와 영향받는 템플릿/문서를 Sync Impact Report(파일 상단 HTML 주석)에 기록한 뒤
커밋한다. 원칙의 추가·삭제·재정의는 MAJOR, 새 원칙 추가나 실질적 내용 확장은 MINOR,
표현 수정이나 오탈자 수정은 PATCH로 버전을 올린다.

**준수 검토**: 모든 PR은 병합 전 이 Constitution의 원칙(특히 API 응답 형식, 에러 형식,
Zod 검증, 서비스 레이어 분리)을 위반하지 않는지 검토되어야 한다. 원칙을 위반하는 복잡성이나
예외가 필요한 경우, PR 설명에 사유를 명시해야 한다.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): 원 제정일 미상, 확인 후 갱신 필요 | **Last Amended**: 2026-09-23
