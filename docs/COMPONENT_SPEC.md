# Tika - 컴포넌트 명세 (COMPONENT_SPEC.md)

> PRD.md(와이어프레임), REQUIREMENTS.md(FR/NFR/US), API_SPEC.md, DATA_MODEL.md(타입), DESIGN_SYSTEM.md를 기준으로 작성한다.
> 컴포넌트는 `src/client/components/`에 위치하며, 파일명은 PascalCase를 따른다 (CLAUDE.md).

---

## 1. 컴포넌트 계층 구조

```
App (page.tsx - 서버 컴포넌트)
│
└── BoardContainer (클라이언트 컴포넌트, 상태 관리)
    │
    ├── BoardHeader
    │   ├── SearchInput (2차 구현 예정, MVP에서는 placeholder)
    │   └── NewTicketButton ─── TicketFormModal (생성 모달)
    │
    ├── Board (DndContext + DragOverlay)
    │   ├── Column (BACKLOG) ─── [좌측 사이드바 위치에 배치]
    │   │   ├── ColumnHeader (칼럼명 + 카드 수, count 숨김 옵션)
    │   │   └── SortableContext
    │   │       ├── TicketCard ─┬─ PriorityBadge
    │   │       │               └─ OverdueIndicator (조건부)
    │   │       └── ...
    │   ├── Column (TODO) ─── [우측 메인 그리드]
    │   │   └── (BACKLOG와 동일 구조)
    │   ├── Column (IN_PROGRESS)
    │   │   └── (동일 구조)
    │   └── Column (DONE)
    │       └── (동일 구조)
    │
    └── TicketModal (상세/수정 모달, TicketCard 클릭 시 오픈)
        ├── TicketDetailView (읽기 전용: 상태, 시작일, 종료일, 생성일)
        ├── TicketForm (수정 모드: 제목/설명/우선순위/시작예정일/종료예정일)
        └── DeleteButton ─── ConfirmDialog
```

### 1.1 설계 노트 (이전 초안 대비 변경 이유)

- **서버/클라이언트 경계 명시**: `app/page.tsx`는 서버 컴포넌트로 유지하고, 상태 관리·DnD 컨텍스트가 필요한 부분만 `BoardContainer`(클라이언트 컴포넌트, `"use client"`)로 분리한다. Next.js App Router에서 클라이언트 상태(모달 열림, 낙관적 업데이트)는 클라이언트 컴포넌트 경계 안에서만 가능하므로, 이 경계를 트리에 명시해 둔다.
- **`Column`으로 4개 상태 통합 (BACKLOG 포함)**: BACKLOG를 별도 `BacklogSidebar` 컴포넌트로 분리했던 이전 초안을 폐기한다. BACKLOG도 다른 3개 상태와 동일하게 `Column` 컴포넌트의 한 인스턴스이며, "좌측 사이드바"는 `BoardContainer`의 레이아웃(위치) 문제일 뿐 컴포넌트 종류를 가르는 기준이 아니다. `ColumnHeader`의 카드 수 표시 여부 차이는 prop(`showCount` 등)으로 처리하며 별도 컴포넌트를 만들지 않는다.
- **`SortableContext`를 트리에 명시**: dnd-kit의 `SortableContext`는 칼럼 내 순서 변경(같은 칼럼 안에서의 재정렬)을 담당하는 실제 컴포넌트이므로, 구현과 명세가 어긋나지 않도록 트리에 직접 표기한다.
- **트리거 관계를 트리 안에 화살표(`───`)로 표기**: "이 버튼을 클릭하면 이 모달이 열린다"는 관계를 별도 문단으로 설명하지 않고 트리 다이어그램 자체에서 바로 보이게 한다 (`NewTicketButton ─── TicketFormModal`, `DeleteButton ─── ConfirmDialog`).
- **`SearchInput`을 트리에 자리만 유지 (2차 구현 예정)**: 검색/필터 기능 자체는 REQUIREMENTS.md FR에 없어 MVP 구현 범위가 아니지만(PRD.md §3 "2차 스펙"), 레이아웃 공간은 미리 잡아둔다. MVP에서는 비활성 placeholder로만 렌더링하고 실제 검색 로직은 만들지 않는다.
- **`TicketModal` 내부를 `TicketDetailView`(읽기 전용) / `TicketForm`(수정)으로 분리**: 티켓 상세 모달에는 사용자가 수정 가능한 필드(제목/설명/우선순위/시작예정일/종료예정일, FR-004)와, 시스템이 자동 기록해 수정 불가능한 필드(`status`, `startedAt`, `completedAt`, `createdAt` — FR-007/DATA_MODEL.md §5.1/5.2)가 섞여 있다. 이전 초안은 이 구분 없이 "필드를 수정할 수 있다"고만 서술해 읽기 전용 필드의 노출 방식이 누락되어 있었다. `TicketDetailView`가 읽기 전용 필드를, `TicketForm`이 수정 가능 필드를 각각 전담하도록 분리한다.
- **생성 모달 트리거 위치**: `NewTicketButton`은 `BoardHeader`에 위치한다 (`docs/reference/image/tika-wireframe.png` 와이어프레임 기준, PRD.md 텍스트 와이어프레임의 사이드바 내부 배치보다 이 손그림을 우선한다).
- **공통 UI primitive**: 위 트리에는 표시하지 않았지만, `Modal`/`Badge`/`ConfirmDialog`/`Button`(§8.5~8.8) 4개는 여러 화면 컴포넌트가 공통으로 재사용하는 기반 컴포넌트다. `TicketFormModal`/`TicketModal`은 `Modal`을, `PriorityBadge`/`OverdueIndicator`는 `Badge`를, `NewTicketButton`/`DeleteButton`은 `Button`을, §6.3의 `ConfirmDialog`는 동명의 primitive를 각각 감싸서 구현한다.
- **`DndContext`는 `BoardContainer`가 아닌 `Board`에 배치**: `BoardContainer`는 데이터(상태) 소유만 담당하고, "화면에 어떻게 그려지고 드래그되는지"는 `Board`가 전담하도록 관심사를 분리한다. `BoardContainer`는 `useTickets`(§3.5)의 반환값을 `board`/`onReorder`/`onComplete` 등 props로 `Board`에 전달하기만 하며, dnd-kit 관련 로직을 직접 갖지 않는다. `Board`가 `onDragEnd`에서 드롭 대상에 따라 이 콜백 props를 호출한다 (§3.4, §3.6 참조). BACKLOG를 포함한 4개 `Column`이 모두 `Board` 하위에 있으므로, 사이드바 ↔ 메인보드 간 이동 감지 범위에는 영향이 없다.

---

## 2. 레이아웃 구성

브레이크포인트별 화면 배치. DESIGN_SYSTEM.md §5 브레이크포인트 기준이며, 실제 배치는 `Board`(§3.4)가 담당한다.

### 2.1 데스크톱 (`lg:` 1024px~)

좌측 사이드바(`Column(BACKLOG)`) + 우측 3칼럼(`TODO`/`IN_PROGRESS`/`DONE`) 가로 배치. `docs/reference/image/tika-wireframe.png` 와이어프레임 및 PRD.md 텍스트 와이어프레임 기준.

```
┌──────────┬───────────────┬───────────────┬───────────────┐
│ BACKLOG  │     TODO      │  IN_PROGRESS  │     DONE      │
│ (280px)  │    (1fr)      │    (1fr)      │    (1fr)      │
│          │               │               │               │
│ [카드]   │   [카드]      │   [카드]      │   [카드]      │
│ [카드]   │   [카드]      │               │               │
│  ...     │    ...        │    ...        │    ...        │
└──────────┴───────────────┴───────────────┴───────────────┘
```

Tailwind 그리드: `grid-cols-[280px_1fr_1fr_1fr]`. BACKLOG 칼럼만 고정 폭(280px)을 가지며 나머지 3칼럼은 균등 분할(`1fr`)된다.

### 2.2 태블릿 (`md:` 768px~)

2칼럼 그리드. BACKLOG + TODO를 1행, IN_PROGRESS + DONE을 2행에 배치한다.

```
┌───────────────┬───────────────┐
│    BACKLOG    │     TODO      │
│    [카드]     │    [카드]     │
│     ...       │     ...       │
├───────────────┼───────────────┤
│  IN_PROGRESS  │     DONE      │
│    [카드]     │    [카드]     │
│     ...       │     ...       │
└───────────────┴───────────────┘
```

### 2.3 모바일 (360px~)

`COLUMN_ORDER`(`src/shared/types`) 순서 그대로 4개 `Column`을 세로로 배치한다. BACKLOG도 다른 칼럼과 동일한 `Column` 컴포넌트이므로 별도 분기 없이 순서만 첫 번째가 된다. 터치 드래그로 칼럼 간 이동 가능 (dnd-kit 포인터 센서).

```
┌───────────────┐
│    BACKLOG    │
│    [카드]     │
│     ...       │
├───────────────┤
│      TODO     │
│    [카드]     │
│     ...       │
├───────────────┤
│  IN_PROGRESS  │
│    [카드]     │
│     ...       │
├───────────────┤
│      DONE     │
│    [카드]     │
│     ...       │
└───────────────┘
```

### 2.4 요약 표

| 브레이크포인트 | Board 배치 | 비고 |
|------|------|------|
| 모바일 (360px~) | `COLUMN_ORDER` 순서로 4개 `Column` 세로 스크롤 | BACKLOG 포함 별도 탭/토글 없음, 터치 드래그로 이동 (dnd-kit 포인터 센서) |
| 태블릿 (`md:` 768px~) | 2칼럼 그리드 | BACKLOG + TODO를 1행, IN_PROGRESS + DONE을 2행 배치 |
| 데스크톱 (`lg:` 1024px~) | 좌측 사이드바(BACKLOG) + 우측 3칼럼 가로 배치 | `docs/reference/image/tika-wireframe.png` 기준 |

---

## 3. 페이지 / 컨테이너

### 3.1 App (`app/page.tsx`, 서버 컴포넌트)

- `"use client"` 없는 순수 서버 컴포넌트. 초기 렌더링에 필요한 최소 골격만 담당하고, 실제 데이터 페칭·상태·인터랙션은 `BoardContainer`에 위임한다.
- 클라이언트 컴포넌트(`BoardContainer`)를 렌더링하는 진입점 역할만 한다.

### 3.2 BoardContainer (클라이언트 컴포넌트)

- 최상위 상태 컨테이너. 티켓 데이터(`BoardData`)와 CRUD/낙관적 업데이트 로직은 직접 구현하지 않고 `useTickets`(§3.5) 훅을 호출해 위임받는다. `BoardContainer`는 모달 열림 상태 등 UI 전용 상태만 별도로 소유한다.
- `DndContext`(dnd-kit)는 이 컴포넌트가 아닌 `Board`(§3.4)에 배치한다 — `BoardContainer`는 dnd-kit 관련 로직을 갖지 않고, `useTickets`가 반환하는 `reorder`/`complete` 액션을 `Board`에 콜백 props(`onReorder`, `onComplete`)로 전달하기만 한다.

| 상태 | 처리 |
|------|------|
| 로딩 중 | `BoardSkeleton` 표시 (§8) |
| 에러 (500 등) | `ErrorBanner` 표시 + 재시도 버튼 |
| 성공 | `Board`에 `BoardData` + `onReorder`/`onComplete` 전달 |

### 3.3 BoardHeader

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onNewTicketClick | `() => void` | O | "새 업무" 클릭 시 `TicketFormModal` 오픈 |

**동작**: 페이지 상단 전역 헤더. 상단 고정(`sticky top-0`) 배치를 권장한다.

#### SearchInput (2차 구현 예정)

MVP에서는 비활성(disabled) placeholder 입력창만 렌더링한다. 실제 검색 로직, API 연동은 구현하지 않는다 (PRD.md §3 "2차 스펙").

#### NewTicketButton

`Button`(§8.8, `variant="primary"`)을 감싸서 사용한다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onClick | `() => void` | O | 클릭 시 `TicketFormModal` 오픈 |

**접근성**: `aria-label="새 티켓 생성"`

### 3.4 Board

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| board | `BoardData` | O | 4개 컬럼 그룹화 티켓 데이터 |
| onTicketClick | `(ticket: TicketWithMeta) => void` | O | 카드 클릭 시 상세 모달 오픈 |
| onReorder | `(ticketId: number, status: ReorderableStatus, position: number) => void` | O | 드롭 대상이 BACKLOG/TODO/IN_PROGRESS일 때 호출 (`useTickets.reorder` 위임) |
| onComplete | `(ticketId: number) => void` | O | 드롭 대상이 DONE일 때 호출 (`useTickets.complete` 위임) |

**로컬 상태**:
| 상태 | 타입 | 설명 |
|------|------|------|
| activeId | `Ticket['id'] \| null` | 현재 드래그 중인 티켓 ID. `onDragStart`에서 설정, `onDragEnd`/`onDragCancel`에서 `null`로 초기화. `DragOverlay`가 이 값으로 `board`에서 해당 티켓을 찾아 미리보기를 렌더링한다 |

`activeId`는 `Board` 자신의 `useState`로만 관리하며 `BoardContainer`로 끌어올리지 않는다 — `BoardContainer`는 dnd-kit 관련 로직을 갖지 않는다는 §1.1 원칙에 따라, 드래그 중 매 프레임 바뀌는 이 값이 상위로 전파되어 불필요한 리렌더링을 유발하지 않도록 한다.

**동작**:
- `DndContext`(dnd-kit)를 이 레벨에 배치한다 (§7 참조) — BACKLOG를 포함한 4개 `Column`이 모두 이 컴포넌트 하위에 있으므로, 사이드바 위치의 `Column(BACKLOG)`과 나머지 `Column`들 사이의 이동도 한 컨텍스트로 감지한다.
- `onDragEnd`에서 드롭 대상 상태에 따라 `onReorder` 또는 `onComplete` prop을 호출한다 — 대상이 `DONE`이면 `onComplete`, 그 외 3개 상태면 `onReorder` (§3.6 참조).
- `DragOverlay`(dnd-kit)를 포함해 드래그 중인 카드 미리보기를 렌더링한다 (`activeId` 기반, 위 표 참조).
- 브레이크포인트별 배치는 §2 "레이아웃 구성" 참조.

### 3.5 useTickets Hook

**역할**: 티켓 CRUD 및 DnD 관련 상태(`BoardData`, 로딩/에러, 낙관적 업데이트/롤백)를 관리하는 커스텀 훅. TRD.md §3.1/§3.3이 규정한 대로, 모든 API 호출과 낙관적 업데이트 롤백 책임은 컴포넌트가 아닌 이 훅이 진다. `BoardContainer`(§3.2)는 이 훅의 반환값을 그대로 사용한다.

**파일**: `src/client/hooks/useTickets.ts`

#### 인터페이스

```typescript
interface UseTicketsReturn {
  // 상태
  board: BoardData;
  isLoading: boolean;
  error: string | null;

  // 액션
  create: (data: CreateTicketInput) => Promise<void>;
  update: (id: number, data: UpdateTicketInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reorder: (ticketId: number, status: ReorderableStatus, position: number) => Promise<void>;
  complete: (id: number) => Promise<void>;
}

function useTickets(initialData: BoardData): UseTicketsReturn;
```

#### 액션별 동작

| 액션 | API | 설명 |
|------|-----|------|
| create | `POST /api/tickets` | 티켓 생성 → Backlog 맨 위에 추가 (FR-001) |
| update | `PATCH /api/tickets/:id` | 제목, 설명, 우선순위, 시작예정일, 종료예정일 수정 (FR-004) |
| remove | `DELETE /api/tickets/:id` | 티켓 영구 삭제 (FR-006) |
| reorder | `PATCH /api/tickets/reorder` | 칼럼 이동 / 순서 변경, DONE 제외 (FR-007) |
| complete | `PATCH /api/tickets/:id/complete` | DONE으로 이동, `completedAt` 자동 설정 (FR-005) |

`reorder`와 `complete`는 `Board`(§3.4)의 `onDragEnd`가 드롭 대상 상태에 따라 `onReorder`/`onComplete` prop을 호출하고, `BoardContainer`가 이 콜백을 받아 각각 `useTickets.reorder`/`useTickets.complete`로 연결한다 (§7 "낙관적 업데이트" 참조) — DONE이면 `complete`, 그 외 3개 상태면 `reorder`.

#### 낙관적 업데이트 패턴

```
1. 현재 board 상태 백업
2. UI 즉시 반영 (board 상태 변경)
3. API 호출
4. 성공: board를 서버 응답으로 확정
5. 실패: 백업한 상태로 롤백 + 에러 표시
```

`reorder`/`complete`의 롤백은 §7 규칙대로 조용히 처리한다(토스트 없음). `create`/`update`/`remove` 실패 시에는 `error` 상태를 채워 `ErrorToast`(§8.3)로 표시한다.

#### API 호출 함수

모든 API 호출은 `src/client/api/ticketApi.ts`를 통해 수행한다 (TRD.md §4 "API 호출 경로" 규칙). 컴포넌트뿐 아니라 이 훅 내부에서도 직접 `fetch`를 호출하지 않는다.

### 3.6 이벤트 흐름

주요 사용자 액션이 컴포넌트 → 훅 → API로 전달되는 흐름을 정리한다. 컴포넌트/훅 이름은 §3.1~3.5, §5, §6, §8의 정의를 따른다.

**드래그 앤 드롭 / 완료 (US-005, US-006, FR-005, FR-007)**

`Board`(§3.4)의 `DndContext`가 발생시키는 `onDragStart`/`onDragOver`/`onDragEnd` 3개 이벤트를 기준으로 정리한다. `onDragEnd`에서 드롭 대상에 따라 완료(Done 진입)와 재정렬(그 외 이동)로 갈라진다 — 이 분기는 `Board`가 §3.4에서 정의한 `onReorder`/`onComplete` prop 호출로 `BoardContainer`에 전달된다.

```
사용자 드래그 시작
  → onDragStart: activeId 설정 (Board 로컬 상태, §3.4), DragOverlay 표시

사용자 드래그 중 (칼럼 위)
  → onDragOver: 대상 Column 하이라이트 (§4.1)

사용자 드롭
  → onDragEnd:
    1. 대상 칼럼(status) 판별
    2-a. [대상 = DONE]
        → 낙관적 업데이트 (board 상태 즉시 반영)
        → Board.onComplete(ticketId) prop 호출 → BoardContainer → useTickets.complete(ticketId)
        → PATCH /api/tickets/:id/complete
        → completedAt 자동 설정 (Done 칼럼에는 completedAt 기준 24시간 이내인 동안만 표시, DATA_MODEL.md §5.4)
    2-b. [대상 = BACKLOG / TODO / IN_PROGRESS]
        → 낙관적 업데이트 (board 상태 즉시 반영)
        → Board.onReorder(ticketId, status, position) prop 호출 → BoardContainer → useTickets.reorder(...)
        → PATCH /api/tickets/reorder
        → startedAt 규칙 적용 (TODO/IN_PROGRESS 진입 시 미설정이면 설정, TODO→BACKLOG 복귀 시 초기화 — DATA_MODEL.md §5.1)
        → completedAt 규칙 적용 (DONE에서 벗어날 때 초기화 — DATA_MODEL.md §5.2)
    3. 성공: board를 서버 응답으로 확정
    4. 실패: 이전 board 상태로 조용히 롤백 (별도 토스트 없음, §7)
```

**티켓 생성 (FR-001, US-001)**
```
BoardHeader("새 업무" 클릭, §3.3)
  → TicketFormModal 오픈 (§6.1)
  → 폼 입력 → Zod 클라이언트 검증 (NFR-004)
  → useTickets.create(input)
  → POST /api/tickets
  → 성공: 보드 갱신 (Backlog 최상단에 반영) / 실패: ErrorToast (§8.3)
```

**티켓 수정 (FR-003, FR-004, US-007)**
```
TicketCard(클릭, §5.1)
  → TicketModal 오픈, GET /api/tickets/:id로 조회 (§6.2)
  → TicketForm 편집 모드 (§6.2)
  → Zod 클라이언트 검증 (NFR-004)
  → useTickets.update(id, input)
  → PATCH /api/tickets/:id
  → 성공: 보드 갱신 / 실패: ErrorToast (§8.3)
```

**티켓 영구 삭제 (FR-006, US-008)**
```
TicketModal(DeleteButton 클릭, §6.3)
  → ConfirmDialog("정말 삭제하시겠습니까?", danger=true, §8.7)
  → 확인
  → useTickets.remove(id)
  → DELETE /api/tickets/:id
  → 성공: 두 모달 닫힘 + 보드에서 카드 제거 / 실패: ErrorToast (§8.3)
```

---

## 4. 칼럼(Column) 영역

### 4.1 Column

BACKLOG / TODO / IN_PROGRESS / DONE 4개 상태 모두 이 컴포넌트 하나를 공용으로 사용한다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| status | `TicketStatus` | O | 이 칼럼이 표시할 상태 |
| tickets | `TicketWithMeta[]` | O | 해당 상태의 티켓 목록 (position 오름차순) |
| onTicketClick | `(ticket: TicketWithMeta) => void` | O | 카드 클릭 핸들러 |

**동작**:
- droppable 영역 (dnd-kit) — DONE 칼럼에 대한 드롭은 `PATCH /api/tickets/:id/complete`, 나머지는 `PATCH /api/tickets/reorder` 호출로 분기 (§7)
- 칼럼 내부에 `SortableContext`(dnd-kit)를 두어 같은 칼럼 안에서의 순서 변경을 지원한다.
- 티켓이 0개일 경우 `EmptyColumnState` 표시 (§8)
- `status === 'DONE'`일 때만 카드 목록 하단에 "24시간 지난 완료 항목은 표시되지 않아요" 안내 텍스트를 고정 표시한다 (DATA_MODEL.md §5.4 24시간 필터 안내). 별도 컴포넌트로 분리하지 않고 `Column`이 조건부로 렌더링하는 정적 텍스트로 처리한다.

### 4.2 ColumnHeader

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| label | `string` | O | `COLUMN_LABELS[status]` 값 |
| count | `number` | O | 카드 수 (US-003) |

---

## 5. 카드(Card) 컴포넌트

### 5.1 TicketCard

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| ticket | `TicketWithMeta` | O | 표시할 티켓 데이터 |
| onClick | `(ticket: TicketWithMeta) => void` | O | 카드 클릭 시 상세 모달 오픈 |

**표시 요소**:
- 제목 (`title`)
- `PriorityBadge` (`priority`)
- `OverdueIndicator` (`isOverdue === true`일 때만 렌더링)
- 종료예정일(`dueDate`) — 존재할 경우 표시

**동작**:
- draggable (dnd-kit) — 드래그 시작 시 `DragOverlay`에 카드 미리보기 표시 (§7)
- 클릭(드래그가 아닌 클릭)으로 `TicketModal` 오픈
- `isOverdue === true`일 때 카드 테두리를 `status.overdue.border` 토큰으로 강조 표시 (DESIGN_SYSTEM.md §1 "Overdue 카드 표시 규칙" — 테두리는 `TicketCard` 자체가, 배지는 `OverdueIndicator`가 각각 담당)

**접근성**: `role="button"`, `aria-label="{title}, 우선순위 {priority}{, 지연됨 (isOverdue인 경우)}"`, 키보드 포커스 가능(`tabIndex=0`), Enter/Space로 상세 모달 오픈

### 5.2 PriorityBadge

내부적으로 `Badge`(§8.6) primitive를 `priority`에 대응하는 variant(`low`/`medium`/`high`)로 감싸서 사용한다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| priority | `TicketPriority` | O | LOW / MEDIUM / HIGH |

색상 매핑은 DESIGN_SYSTEM.md §1 "우선순위 뱃지" 및 §8.6 variant 매핑 참조.

### 5.3 OverdueIndicator

내부적으로 `Badge`(§8.6, `variant="overdue"`)를 경고 아이콘과 함께 사용한다.

**Props**: 없음 (조건부 렌더링만 담당, 부모가 `isOverdue` 체크 후 렌더링)

**표시**: 경고 아이콘 + "지연" 텍스트 뱃지. 색상은 `status.overdue` 토큰 사용 (DESIGN_SYSTEM.md §1).

**접근성**: `aria-label="지연됨"`

---

## 6. 티켓 생성 / 상세·수정 / 삭제

이 섹션의 모달들은 모두 공통 `Modal` primitive(§8.5)를 감싸서 구현하며, 오버레이/ESC 닫기/포커스 이동/스크롤 잠금 동작은 `Modal`이 제공하는 것을 그대로 물려받는다.

### 6.1 TicketFormModal (생성 전용)

FR-001, US-001, US-002 대응. `BoardHeader`의 `NewTicketButton`에서만 오픈된다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| isOpen | `boolean` | O | 모달 표시 여부 |
| onClose | `() => void` | O | 닫기(취소) 핸들러 |
| onSubmit | `(input: CreateTicketInput) => Promise<void>` | O | 제출 시 `POST /api/tickets` 호출 |

**필드**: 제목(필수, 자동 포커스) / 설명(선택) / 우선순위(선택, 기본 MEDIUM) / 시작예정일(선택) / 종료예정일(선택, 오늘 이후만 선택 가능)

**동작**:
- 제목만 입력하고 제출 가능 (US-001)
- 클라이언트 사이드 Zod 검증 (NFR-004) — 서버 에러 메시지와 동일한 문구 사용 (REQUIREMENTS.md FR-001 검증 에러 메시지 표)
- 제출 성공 시 모달 닫힘 + Backlog 칼럼 최상단에 카드 반영 (US-001)
- 제출 실패(400) 시 모달 유지, 필드별 에러 메시지 표시 — 내부적으로 `TicketForm`(§6.2)의 `errors` prop에 필드별 메시지를 채워 전달하는 방식으로 구현한다

### 6.2 TicketModal (상세/수정 전용)

FR-003, FR-004, US-007 대응. `TicketCard` 클릭 시 오픈된다. 내부는 읽기 전용 영역(`TicketDetailView`)과 수정 폼(`TicketForm`)으로 구성된다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| isOpen | `boolean` | O | 모달 표시 여부 |
| ticketId | `number \| null` | O | 조회할 티켓 ID (`GET /api/tickets/:id`) |
| onClose | `() => void` | O | 닫기 핸들러 |
| onSubmit | `(id: number, input: UpdateTicketInput) => Promise<void>` | O | 저장 시 `PATCH /api/tickets/:id` 호출 |
| onDelete | `(id: number) => Promise<void>` | O | 삭제 확정 시 `DELETE /api/tickets/:id` 호출 |

**동작**:
- 오픈 시 `GET /api/tickets/:id`로 최신 데이터 조회
- 저장 시 변경된 필드만 `PATCH` 요청 (Partial Update)
- 변경된 필드를 사용자에게 시각적으로 구분해 보여주지는 않는다 — `TicketForm`은 모든 필드를 항상 동일하게 표시하고, "어떤 필드가 바뀌었는지" 추적은 API 호출 시점의 내부 로직(변경분만 PATCH body에 포함)에 국한된다.
- 하단에 `DeleteButton` 배치 → 클릭 시 `ConfirmDialog` 오픈 (US-008)
- 저장 성공 시 모달 닫힘 + 보드에 즉시 반영 (US-007)

#### TicketDetailView (읽기 전용)

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| ticket | `TicketWithMeta` | O | 조회된 티켓 데이터 |

**표시 필드** (모두 시스템이 자동 기록하며 사용자가 직접 수정할 수 없음):
| 필드 | 근거 |
|------|------|
| status | FR-007/FR-005 — 드래그앤드롭 또는 완료 처리로만 변경 (이 모달에서 변경 불가) |
| startedAt (시작일) | DATA_MODEL.md §5.1 — TODO/IN_PROGRESS 진입 시 시스템 자동 설정 |
| completedAt (종료일) | DATA_MODEL.md §5.2 — DONE 진입 시 시스템 자동 설정 |
| createdAt (생성일) | 생성 시점 자동 기록 |

`status`는 `Badge`(§8.6) primitive를 사용하지 않고 일반 텍스트로 표시한다. `Badge`의 variant 목록(`low`/`medium`/`high`/`overdue`/`neutral`)에는 상태(`BACKLOG`/`TODO`/`IN_PROGRESS`/`DONE`)용 색상이 정의되어 있지 않으며, §11 접근성 원칙("색상에만 의존하지 않음")에 따라 별도 색상 확장 없이 텍스트만으로 표시해도 충분하다.

#### TicketForm (수정 모드)

`TicketFormModal`(§6.1, 생성)과 `TicketModal`(§6.2, 수정) 양쪽에서 공용으로 사용하는 컴포넌트다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| ticket | `TicketWithMeta` | O | 초기값으로 사용할 티켓 데이터 |
| onSubmit | `(input: UpdateTicketInput) => Promise<void>` | O | 저장 핸들러 |
| errors | `Record<string, string>` | X (기본 `{}`) | 필드별 에러 메시지. key는 API_SPEC.md 400 응답의 `error.field` 값(`title`/`description`/`priority`/`dueDate` 등)과 동일하게 맞춘다 |

**필드**: 제목 / 설명 / 우선순위 / 시작예정일 / 종료예정일 (수정 가능, FR-004). `status`/`position`은 이 폼에서 다루지 않는다 (드래그앤드롭 전용, FR-007) — `TicketDetailView`에서 읽기 전용으로만 표시된다.

**에러 표시 동작**:
- 클라이언트 사이드 Zod 검증 실패, 서버 400 응답(`error.field` 존재) 모두 동일하게 `errors` prop을 통해 전달받는다 — 검증 주체(클라이언트/서버)에 따라 표시 방식을 분기하지 않는다.
- `errors[fieldName]`이 있으면 해당 입력 필드 바로 아래에 메시지를 표시한다.
- `error.field`가 없는 400 응답(필드 특정 불가)은 이 prop으로 전달하지 않고, 호출부(`TicketFormModal`/`TicketModal`)가 폼 상단 또는 `ErrorToast`(§8.3)로 표시한다.

### 6.3 DeleteButton / ConfirmDialog

FR-006, US-008 대응. `DeleteButton`은 `Button`(§8.8, `variant="danger"`)을, `ConfirmDialog`는 공통 `ConfirmDialog` primitive(§8.7)를 그대로 사용한다.

**DeleteButton Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onClick | `() => void` | O | 클릭 시 `ConfirmDialog` 오픈 |

**ConfirmDialog 사용**: `title="정말 삭제하시겠습니까?"`, `danger={true}`로 §8.7 primitive를 호출한다.

**동작**: 확인 시 `TicketModal`의 `onDelete` 호출 → 성공 시 두 모달 모두 닫히고 카드가 보드에서 사라짐.

---

## 7. 드래그앤드롭 레이어

- `DndContext`는 `Board`(§3.4) 최상위에 배치하여 어떤 `Column`(BACKLOG 포함)에서 어떤 `Column`으로든 이동을 모두 감지한다 (US-005: "어떤 칼럼에서든 어떤 칼럼으로든 이동 가능"). `BoardContainer`는 dnd-kit 관련 로직을 갖지 않는다 (§1.1 "설계 노트" 참조).
- 칼럼 내부의 `SortableContext`(§4.1)가 같은 칼럼 안에서의 순서 변경(재정렬)을 담당한다.
- `DragOverlay`로 드래그 중인 카드의 미리보기를 렌더링한다 (DESIGN_SYSTEM.md §3, `shadow-lg`).
- **낙관적 업데이트(NFR-004)**: 드롭 발생 시 `Board`의 `onDragEnd`가 대상 상태에 따라 `onReorder`/`onComplete` prop을 호출하고, 이를 받은 `BoardContainer`가 `useTickets`(§3.5)의 대응 액션을 호출한다. `useTickets`가 `BoardData` 상태를 즉시 갱신(status/position 반영)한 뒤 API를 호출하는 낙관적 업데이트를 내부적으로 수행한다.
  - 대상이 `DONE`: `Board.onComplete(id)` → `BoardContainer` → `useTickets.complete(id)` → `PATCH /api/tickets/:id/complete`
  - 대상이 `BACKLOG`/`TODO`/`IN_PROGRESS`: `Board.onReorder(ticketId, status, position)` → `BoardContainer` → `useTickets.reorder(...)` → `PATCH /api/tickets/reorder`
- API 실패 시 `useTickets`가 드롭 이전 `BoardData` 스냅샷으로 조용히 롤백한다(별도 토스트/알림 없음) — 카드가 원래 위치로 즉시 되돌아가는 시각적 변화 자체가 실패를 알리는 신호이므로 추가 알림 컴포넌트를 두지 않는다.
- 키보드 조작(NFR-003)은 dnd-kit의 기본 키보드 센서 패턴을 따른다: Tab으로 카드 포커스 → Space로 픽업 → 화살표 키로 칼럼/위치 이동 → Space로 드롭, Esc로 취소.

---

## 8. 공통 / 유틸 컴포넌트

### 8.1 BoardSkeleton
초기 로딩 중 4개 칼럼 형태의 스켈레톤 UI 표시.

### 8.2 ErrorBanner
**Props**: `message: string`, `onRetry: () => void`
보드 초기 로드(`GET /api/tickets`) 실패(500) 시 전체 화면에 표시.

### 8.3 ErrorToast
**Props**: `message: string`
생성/수정/삭제 등 모달 기반 액션의 API 실패 시 일시적으로 표시되는 토스트. 드래그앤드롭 실패는 조용히 롤백만 하고 이 토스트를 띄우지 않는다 (§7).

### 8.4 EmptyColumnState
**Props**: `label: string` (예: "아직 카드가 없어요")
칼럼에 티켓이 0개일 때 표시.

### 8.5 Modal (공통 primitive)

`TicketFormModal`(§6.1), `TicketModal`(§6.2)이 내부적으로 이 컴포넌트를 감싸서 사용한다. 모달 특유의 반복 동작(오버레이, 포커스, 스크롤 잠금)을 한곳에서 구현하고, 개별 모달은 내용(children)만 채운다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| isOpen | `boolean` | O | 표시 여부 |
| onClose | `() => void` | O | 오버레이 클릭/ESC 시 호출 |
| children | `ReactNode` | O | 모달 내용 |

**동작**:
- 오버레이(반투명 배경) + 중앙 정렬 컨테이너 (DESIGN_SYSTEM.md §3 `rounded-xl`, `shadow-lg`)
- ESC 키 또는 오버레이 바깥 클릭 시 `onClose` 호출
- 열림/닫힘 전환에 짧은 페이드/스케일 애니메이션 적용 (`transition` 유틸리티 클래스 수준, 별도 애니메이션 라이브러리 도입하지 않음)
- 열려 있는 동안 `<body>` 스크롤을 잠가 배경 콘텐츠가 함께 스크롤되지 않게 한다
- `role="dialog"`, `aria-modal="true"`, 오픈 시 내부 첫 포커스 가능 요소로 자동 포커스 이동 (§10 접근성 매핑과 연결)

### 8.6 Badge (공통 primitive)

`PriorityBadge`(§5.2), `OverdueIndicator`(§5.3)가 이 컴포넌트를 감싸서 사용한다. 색상/크기 스타일을 한곳에서 관리하고, 개별 배지는 색상 variant와 텍스트만 결정한다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| variant | `'low' \| 'medium' \| 'high' \| 'overdue' \| 'neutral'` | O | 색상 변형 |
| children | `ReactNode` | O | 배지 텍스트 |

**variant → 색상 매핑** (DESIGN_SYSTEM.md §1 토큰 기준):
| variant | 배경 | 텍스트 | 사용처 |
|------|------|------|------|
| low | `priority.low.bg` (회색) | `priority.low.text` | 우선순위 LOW |
| medium | `priority.medium.bg` (파란색) | `priority.medium.text` | 우선순위 MEDIUM |
| high | `priority.high.bg` (빨간색) | `priority.high.text` | 우선순위 HIGH |
| overdue | `status.overdue.bg` | `status.overdue.text` | `OverdueIndicator` 전용 |

**스타일**: 작은 텍스트(`text-xs`) + 둥근 패딩(`rounded-full px-2 py-0.5`, DESIGN_SYSTEM.md §3 라운딩 규칙).

### 8.7 ConfirmDialog (공통 primitive)

§6.3에서 정의한 `ConfirmDialog`는 이 primitive의 구체 사용처다 (삭제 확인, FR-006/US-008). "정말 삭제하시겠습니까?" 같은 확인 문구와 액션은 호출부(`TicketModal`)가 props로 채운다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| isOpen | `boolean` | O | 표시 여부 |
| title | `string` | O | 확인 문구 (예: "정말 삭제하시겠습니까?") |
| onConfirm | `() => Promise<void>` | O | 확인 시 실행할 액션 |
| onCancel | `() => void` | O | 취소 |
| danger | `boolean` | X (기본 `false`) | `true`면 확인 버튼을 위험 스타일(`Button variant="danger"`)로 렌더링 |

**동작**:
- 내부적으로 `Modal`(§8.5)을 감싸 사용한다 (오버레이/ESC/포커스 동작 재사용).
- 확인/취소 버튼은 `Button`(§8.8)을 사용하며, `danger=true`(삭제 등 위험 동작)일 때 확인 버튼은 `variant="danger"`로 렌더링한다.
- `role="alertdialog"`, 확인 버튼에 기본 포커스를 두지 않고 취소 버튼에 기본 포커스를 둔다(실수로 확인을 누르는 것을 방지).

### 8.8 Button (공통 primitive)

`NewTicketButton`(§3.3), `DeleteButton`(§6.3), 모달의 제출/취소 버튼 등 모든 버튼형 UI가 이 컴포넌트를 사용한다.

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| variant | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | X (기본 `primary`) | 색상/스타일 변형 |
| size | `'sm' \| 'md' \| 'lg'` | X (기본 `md`) | 크기 |
| isLoading | `boolean` | X (기본 `false`) | `true`면 스피너 표시 + 클릭 비활성화 |
| onClick | `() => void` | X | 클릭 핸들러 |
| children | `ReactNode` | O | 버튼 라벨 |

**variant 매핑**:
| variant | 용도 | 색상 토큰 |
|------|------|------|
| primary | 기본 액션 (예: `NewTicketButton`, 모달 저장/제출) | `brand.primary` / `brand.primaryHover` |
| secondary | 보조 액션 (예: 모달 취소) | `border.strong` 테두리 + `text.primary` |
| danger | 위험 액션 (예: `DeleteButton`, 삭제 확인) | `status.danger.bg` / `status.danger.text` |
| ghost | 배경 없는 최소 강조 버튼 | 배경 투명, `text.secondary` |

**로딩 상태**: `isLoading=true`일 때 버튼 내부에 스피너를 표시하고 `disabled` 처리한다. `TicketFormModal`/`TicketModal`의 제출 버튼은 API 호출 중 이 상태를 사용한다 (예: 생성/수정 요청이 진행 중일 때 중복 제출 방지).

---

## 9. Props 요약 테이블

컴포넌트만 정리한다. 상태 관리 훅(`useTickets`)의 인터페이스는 §3.5 참조.

| 컴포넌트 | 주요 Props | 주요 이벤트 |
|------|------|------|
| BoardContainer | (없음, 최상위) | - |
| BoardHeader | onNewTicketClick | - |
| Board | board, onTicketClick, onReorder, onComplete (+ 로컬 상태 activeId) | onDragEnd(dnd-kit 내부) → onReorder/onComplete 호출 |
| Column | status, tickets, onTicketClick | - |
| ColumnHeader | label, count | - |
| TicketCard | ticket, onClick | onClick, (드래그 이벤트는 dnd-kit이 처리) |
| PriorityBadge | priority | - |
| OverdueIndicator | (없음) | - |
| TicketFormModal | isOpen, onClose, onSubmit | onSubmit, onClose |
| TicketModal | isOpen, ticketId, onClose, onSubmit, onDelete | onSubmit, onDelete, onClose |
| TicketDetailView | ticket | - |
| TicketForm | ticket, onSubmit, errors | onSubmit |
| DeleteButton | onClick | - |
| Modal (primitive) | isOpen, onClose, children | onClose |
| Badge (primitive) | variant, children | - |
| ConfirmDialog (primitive) | isOpen, title, onConfirm, onCancel, danger | onConfirm, onCancel |
| Button (primitive) | variant, size, isLoading, onClick, children | onClick |

---

## 10. 상태 관리 & 데이터 흐름

- `BoardData` 전체는 `useTickets`(§3.5) 훅이 단일 소스로 보유하며, `BoardContainer`(클라이언트 컴포넌트, 최상위)가 이 훅을 호출해 하위 컴포넌트에 props로 전달한다. 하위 컴포넌트는 props로 내려받은 데이터만 표시하고, 자체적으로 서버 데이터를 재조회하지 않는다 (단, `TicketModal`은 오픈 시 최신 단건 데이터를 별도 조회한다 — §6.2).
- API 호출은 `src/client/api/ticketApi.ts`를 통해서만 수행한다 (CLAUDE.md 규칙). `useTickets`를 포함해 어떤 컴포넌트/훅도 직접 `fetch`를 호출하지 않는다.
- 낙관적 업데이트/롤백 상태는 `useTickets` 내부에서 관리한다 (드롭 직전 스냅샷 보관 → 실패 시 복원, §3.5/§7). `BoardContainer`는 이 상태를 직접 소유하지 않고 훅의 반환값을 그대로 사용한다.
- 드래그앤드롭 이벤트(`DndContext`, `onDragEnd`)는 `BoardContainer`가 아닌 `Board`(§3.4)가 소유한다. `Board`는 드롭 결과를 `onReorder`/`onComplete` prop으로 `BoardContainer`에 올려보내고, `BoardContainer`가 이를 받아 `useTickets`의 대응 액션을 호출한다 (§7).
- 모달의 열림/닫힘 상태(`TicketFormModal`, `TicketModal`, `ConfirmDialog`)와 선택된 `ticketId`는 `BoardContainer`가 관리하고 콜백으로 하위에 전달한다. `TicketFormModal`은 `BoardHeader`의 `onNewTicketClick`, `TicketModal`은 `TicketCard`의 `onClick`이 각각 오픈을 트리거하지만 열림 상태 자체는 항상 `BoardContainer`가 소유한다.

---

## 11. 접근성 (NFR-003) 매핑

| 컴포넌트 | 접근성 요소 |
|------|------|
| TicketCard | `role="button"`, `aria-label`, `tabIndex=0`, Enter/Space로 모달 오픈, 드래그는 dnd-kit 키보드 센서 (§7) |
| Column | droppable 영역에 `aria-label="{칼럼명} 칼럼"` |
| PriorityBadge | 텍스트로 우선순위 노출(아이콘/색상에만 의존하지 않음) |
| OverdueIndicator | `aria-label="지연됨"`, 아이콘 + 텍스트 병행 (색상에만 의존하지 않음) |
| NewTicketButton | `aria-label="새 티켓 생성"` |
| TicketFormModal / TicketModal | `role="dialog"`, `aria-modal="true"`, 오픈 시 첫 입력 필드로 포커스 이동, Esc로 닫기 |
| ConfirmDialog | `role="alertdialog"`, 확인 버튼에 기본 포커스 없음(실수 방지, 취소에 기본 포커스) |
| 색상 대비 | DESIGN_SYSTEM.md 토큰은 WCAG AA 기준(4.5:1) 충족 값 사용 |

---

## 12. UseCase — 컴포넌트 — Hook 매핑

REQUIREMENTS.md의 사용자 스토리(US-001~008)가 어떤 컴포넌트와 `useTickets`(§3.5) 액션으로 구현되는지 한 표로 정리한다. 상세 흐름은 §3.6 "이벤트 흐름" 참조.

| UseCase | 관련 FR | 진입 컴포넌트 | 처리 컴포넌트 | useTickets 액션 |
|------|------|------|------|------|
| US-001 새 할 일 등록 | FR-001 | `NewTicketButton`(§3.3) | `TicketFormModal`(§6.1) | `create` |
| US-002 상세 정보 설정 | FR-001 | `NewTicketButton`(§3.3) | `TicketFormModal`(§6.1) | `create` |
| US-003 칸반 보드 현황 파악 | FR-002, FR-008 | `BoardContainer`(§3.2) | `Board`(§3.4), `Column`(§4.1), `ColumnHeader`(§4.2), `TicketCard`(§5.1) | (조회, `board` 상태) |
| US-004 마감 초과 인지 | FR-008 | - | `TicketCard`(§5.1), `OverdueIndicator`(§5.3) | (조회, `board` 상태의 `isOverdue`) |
| US-005 드래그앤드롭 상태 변경 | FR-007 | `TicketCard`(§5.1) | `Board`(§3.4, `DndContext`), `Column`(§4.1) | `reorder` |
| US-006 할 일 완료 처리 | FR-005 | `TicketCard`(§5.1) | `Board`(§3.4, `DndContext`) | `reorder`(startedAt), `complete`(completedAt) |
| US-007 할 일 수정 | FR-003, FR-004 | `TicketCard`(§5.1) | `TicketModal`(§6.2), `TicketForm`(§6.2) | `update` |
| US-008 할 일 삭제 | FR-006 | `DeleteButton`(§6.3) | `ConfirmDialog`(§8.7) | `remove` |

- US-003/US-004는 사용자 액션이 아닌 조회 시점에 반영되는 흐름이라 별도 "진입 컴포넌트"가 없다 — `useTickets`의 `board` 상태(및 파생 필드 `isOverdue`)를 하위 컴포넌트가 props로 받아 표시하기만 한다.
- US-006은 REQUIREMENTS.md 인수 조건상 `startedAt`(TODO/IN_PROGRESS 진입·복귀)과 `completedAt`(DONE 진입·이탈) 두 필드를 다루는데, 전자는 `reorder` 액션이, 후자는 `complete` 액션과 `reorder` 액션(DONE 이탈 시 초기화)이 나누어 처리한다 — §3.6 "드래그 앤 드롭 / 완료" 흐름 참조.
