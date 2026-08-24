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

## 코딩 컨벤션

### TypeScript
```typescript
// Good
interface Ticket {
  id: number;
  title: string;
}

export const TICKET_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
} as const;

type TicketStatus = typeof TICKET_STATUS[keyof typeof TICKET_STATUS];

// Bad
interface Ticket {...}
enum TicketStatus {...}
let data:any;
```
### 백엔드 (app/api/ + src/server)

### Route Hander 패턴
```typescript
//app/api/tickets/route.ts
import { createTicketSchema } from '@/shared/validations/ticket';
import { ticketService } from '@/server/services/ticketService';

export async function POST(request: Request) {
  // 1. 요청 파싱
  const body = await request.json();

  // 2. Zod 검증
  const result = createTicketSchema.safeParse(body);
  if(!result.success) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: result.error.message} },
      {status: 400}
    );
  }

  // 3. 서비스 호출
  const ticket = await ticketService.create(result.data);

  //4. 응답 반환
  return Response.json(ticket, { status: 201} );
}
```

### 서비스 레이어 패턴
```typescript
// src/server/services/ticketService.ts
import { db } from '@/server/db';
import { tickets } from '@/server/db/schema';
import type { CreateTicketInput, Ticket } from '@/shared/types';

export const ticketService = {
  async create(input: CreateTicketInput): Promise<Ticket> {
    // 비즈니스 로직
    const position = await this.calculatePosition(input.status);

    // DB 쿼리
    const [ticket] = await db
      .insert(tickets)
      .values({...input, position})
      .returning();

    return ticket;
  },

  async calculatePosition(status: string): Promise<number> {
  //복잡한 로직은 별도 메서드로 분리
  const lastTicket = await db
    .select()
    .from(tickets)
    .where(eq(tickets.status, status))
    .order(desc(tickets.position))
    .limit(1);

  return (lastTicket[0]?.position ?? 0)  -1024;
  }

};
```

