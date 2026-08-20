@AGENTS.md


# CLAUDE.md - Tika Development Guide

> **핵심 원칙은 `.specify/memory/constitution.md` 참조**
> 이 문서는 구체적인 구현 방법과 실무 가이드를 다룬다.

## 프로젝트 구조
```

tika/
├── .claude/ 
└── docs/

```

### .claude/ 디렉토리 구조 (Claude Code 전용)
- **`.claude/skills/`**: 권장 형식, 디렉토리 + `SKILL.md` + 지원 파일
  - 예: `.claude/skills/changelog/SKILL.md`
  - YAML frontmatter 필수 (name, description, user-invocable 등)
- **`.claude/commands/`**: 레거시 형식, 단일 `.md` 파일 (여전히 작동)
  - 예: `.claude/commands/speckit.plan.md`
  - Skills보다 기능이 제한적이지만 간단한 용도로 사용 가능
- **공식문서**: https://code.claude.com/docs/skills.md

## 기술 스택
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Frontend**: React 19
- **Styling**: Tailwind CSS 4
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **ORM**: Drizzle ORM 0.38.x
- **DB**: PostgreSQL (로컬: node-postgres, 배포: Vercel Postgres)
- **Validation**: Zod
- **Testing**: Jest + React Testing Library
- **Deployment**: Vercel

## MCP Servers (Model Context Protocol)

### Context7 - 공식 문서 자동 참조

## 환경 설정

### 환경 변수
```bash
# .env.local
DATABASE_URL=postgresql://user.password@localhost:5432/tika
```

### 경로 별칭
- `@/` → `src/`
- `@/app/` → `app/`
- `@/shared/` → `src/shared/`
- `@/server/` → `src/server/`
- `@/client/` → `src/client/`

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