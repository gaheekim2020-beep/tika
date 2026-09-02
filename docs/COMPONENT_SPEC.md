# Tika - 컴포넌트 명세 (COMPONENT_SPEC.md)

> PRD.md(와이어프레임), REQUIREMENTS.md(FR/NFR/US), API_SPEC.md, DATA_MODEL.md(타입), DESIGN_SYSTEM.md를 기준으로 작성한다.
> 컴포넌트는 `src/client/components/`에 위치하며, 파일명은 PascalCase를 따른다 (CLAUDE.md).

---

## 1. 컴포넌트 계층 구조

```
App (page.tsx - 서버 컴포넌트)
│
└── BoardContainer (클라이언트 컴포넌트, 상태 관리 + DnD 컨텍스트)
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

---

## 2. 페이지 / 컨테이너

### 2.1 App (`app/page.tsx`, 서버 컴포넌트)

- `"use client"` 없는 순수 서버 컴포넌트. 초기 렌더링에 필요한 최소 골격만 담당하고, 실제 데이터 페칭·상태·인터랙션은 `BoardContainer`에 위임한다.
- 클라이언트 컴포넌트(`BoardContainer`)를 렌더링하는 진입점 역할만 한다.

### 2.2 BoardContainer (클라이언트 컴포넌트)

- 최상위 상태 컨테이너. `GET /api/tickets` 호출로 `BoardData`를 가져오고, 보드 전체 상태(로딩/에러/데이터, 모달 열림 상태, 낙관적 업데이트 스냅샷)를 소유한다.
- `DndContext`(dnd-kit)를 이 레벨에 배치한다 (§7 참조) — 사이드바 위치의 `Column(BACKLOG)`과 나머지 `Column`들 사이의 이동을 한 컨텍스트로 감지하기 위함.

| 상태 | 처리 |
|------|------|
| 로딩 중 | `BoardSkeleton` 표시 (§8) |
| 에러 (500 등) | `ErrorBanner` 표시 + 재시도 버튼 |
| 성공 | `Board`에 `BoardData` 전달 |

### 2.3 BoardHeader

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onNewTicketClick | `() => void` | O | "새 업무" 클릭 시 `TicketFormModal` 오픈 |

**동작**: 페이지 상단 전역 헤더. 상단 고정(`sticky top-0`) 배치를 권장한다.

#### SearchInput (2차 구현 예정)

MVP에서는 비활성(disabled) placeholder 입력창만 렌더링한다. 실제 검색 로직, API 연동은 구현하지 않는다 (PRD.md §3 "2차 스펙").

#### NewTicketButton

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onClick | `() => void` | O | 클릭 시 `TicketFormModal` 오픈 |

**접근성**: `aria-label="새 티켓 생성"`

### 2.4 Board

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| board | `BoardData` | O | 4개 컬럼 그룹화 티켓 데이터 |
| onTicketClick | `(ticket: TicketWithMeta) => void` | O | 카드 클릭 시 상세 모달 오픈 |

**동작**:
- `DragOverlay`(dnd-kit)를 포함해 드래그 중인 카드 미리보기를 렌더링한다 (§7).
- 데스크톱(`lg:` 1024px~): `Column(BACKLOG)`을 좌측 사이드바 폭으로, 나머지 3개 `Column`을 우측 가로 배치 (grid-cols-[280px_1fr_1fr_1fr] 형태)
- 태블릿(`md:` 768px~): 2칼럼 그리드
- 모바일(360px~): `COLUMN_ORDER`(`src/shared/types`) 순서 그대로 4개 `Column`을 세로로 배치한다. BACKLOG도 다른 칼럼과 동일한 `Column` 컴포넌트이므로 별도 분기 없이 순서만 첫 번째가 된다.

---

## 3. 칼럼(Column) 영역

### 3.1 Column

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

### 3.2 ColumnHeader

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| label | `string` | O | `COLUMN_LABELS[status]` 값 |
| count | `number` | O | 카드 수 (US-003) |

---

## 4. 카드(Card) 컴포넌트

### 4.1 TicketCard

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

### 4.2 PriorityBadge

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| priority | `TicketPriority` | O | LOW / MEDIUM / HIGH |

색상 매핑은 DESIGN_SYSTEM.md §1 "우선순위 뱃지" 참조.

### 4.3 OverdueIndicator

**Props**: 없음 (조건부 렌더링만 담당, 부모가 `isOverdue` 체크 후 렌더링)

**표시**: 경고 아이콘 + "지연" 텍스트 뱃지. 색상은 `status.overdue` 토큰 사용 (DESIGN_SYSTEM.md §1).

**접근성**: `aria-label="지연됨"`

---

## 5. 티켓 생성 / 상세·수정 / 삭제

### 5.1 TicketFormModal (생성 전용)

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
- 제출 실패(400) 시 모달 유지, 필드별 에러 메시지 표시

### 5.2 TicketModal (상세/수정 전용)

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

#### TicketForm (수정 모드)

**Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| ticket | `TicketWithMeta` | O | 초기값으로 사용할 티켓 데이터 |
| onSubmit | `(input: UpdateTicketInput) => Promise<void>` | O | 저장 핸들러 |

**필드**: 제목 / 설명 / 우선순위 / 시작예정일 / 종료예정일 (수정 가능, FR-004). `status`/`position`은 이 폼에서 다루지 않는다 (드래그앤드롭 전용, FR-007) — `TicketDetailView`에서 읽기 전용으로만 표시된다.

### 5.3 DeleteButton / ConfirmDialog

FR-006, US-008 대응.

**DeleteButton Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| onClick | `() => void` | O | 클릭 시 `ConfirmDialog` 오픈 |

**ConfirmDialog Props**:
| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| isOpen | `boolean` | O | 표시 여부 |
| onConfirm | `() => Promise<void>` | O | 확인 시 삭제 실행 |
| onCancel | `() => void` | O | 취소 |

**동작**: 확인 시 `TicketModal`의 `onDelete` 호출 → 성공 시 두 모달 모두 닫히고 카드가 보드에서 사라짐.

---

## 6. 드래그앤드롭 레이어

- `DndContext`는 `BoardContainer`(§2.2) 최상위에 배치하여 어떤 `Column`(BACKLOG 포함)에서 어떤 `Column`으로든 이동을 모두 감지한다 (US-005: "어떤 칼럼에서든 어떤 칼럼으로든 이동 가능").
- 칼럼 내부의 `SortableContext`(§3.1)가 같은 칼럼 안에서의 순서 변경(재정렬)을 담당한다.
- `DragOverlay`로 드래그 중인 카드의 미리보기를 렌더링한다 (DESIGN_SYSTEM.md §3, `shadow-lg`).
- **낙관적 업데이트(NFR-004)**: 드롭 발생 시 `BoardContainer`가 보유한 `BoardData` 상태를 즉시 갱신(status/position 반영)한 뒤, 대상 상태에 따라 API를 호출한다.
  - 대상이 `DONE`: `PATCH /api/tickets/:id/complete`
  - 대상이 `BACKLOG`/`TODO`/`IN_PROGRESS`: `PATCH /api/tickets/reorder`
- API 실패 시 드롭 이전 `BoardData` 스냅샷으로 조용히 롤백한다(별도 토스트/알림 없음) — 카드가 원래 위치로 즉시 되돌아가는 시각적 변화 자체가 실패를 알리는 신호이므로 추가 알림 컴포넌트를 두지 않는다.
- 키보드 조작(NFR-003)은 dnd-kit의 기본 키보드 센서 패턴을 따른다: Tab으로 카드 포커스 → Space로 픽업 → 화살표 키로 칼럼/위치 이동 → Space로 드롭, Esc로 취소.

---

## 7. 공통 / 유틸 컴포넌트

### 7.1 BoardSkeleton
초기 로딩 중 4개 칼럼 형태의 스켈레톤 UI 표시.

### 7.2 ErrorBanner
**Props**: `message: string`, `onRetry: () => void`
보드 초기 로드(`GET /api/tickets`) 실패(500) 시 전체 화면에 표시.

### 7.3 ErrorToast
**Props**: `message: string`
생성/수정/삭제 등 모달 기반 액션의 API 실패 시 일시적으로 표시되는 토스트. 드래그앤드롭 실패는 조용히 롤백만 하고 이 토스트를 띄우지 않는다 (§6).

### 7.4 EmptyColumnState
**Props**: `label: string` (예: "아직 카드가 없어요")
칼럼에 티켓이 0개일 때 표시.

---

## 8. Props 요약 테이블

| 컴포넌트 | 주요 Props | 주요 이벤트 |
|------|------|------|
| BoardContainer | (없음, 최상위) | - |
| BoardHeader | onNewTicketClick | - |
| Board | board, onTicketClick | - |
| Column | status, tickets, onTicketClick | - |
| ColumnHeader | label, count | - |
| TicketCard | ticket, onClick | onClick, (드래그 이벤트는 dnd-kit이 처리) |
| PriorityBadge | priority | - |
| OverdueIndicator | (없음) | - |
| TicketFormModal | isOpen, onClose, onSubmit | onSubmit, onClose |
| TicketModal | isOpen, ticketId, onClose, onSubmit, onDelete | onSubmit, onDelete, onClose |
| TicketDetailView | ticket | - |
| TicketForm | ticket, onSubmit | onSubmit |
| DeleteButton / ConfirmDialog | onClick / isOpen, onConfirm, onCancel | onConfirm, onCancel |

---

## 9. 상태 관리 & 데이터 흐름

- `BoardData` 전체는 `BoardContainer`(클라이언트 컴포넌트, 최상위)가 단일 소스로 보유한다. 하위 컴포넌트는 props로 내려받은 데이터만 표시하고, 자체적으로 서버 데이터를 재조회하지 않는다 (단, `TicketModal`은 오픈 시 최신 단건 데이터를 별도 조회한다 — §5.2).
- API 호출은 `src/client/api/ticketApi.ts`를 통해서만 수행한다 (CLAUDE.md 규칙).
- 낙관적 업데이트/롤백 상태는 `BoardContainer` 레벨에서 관리한다 (드롭 직전 스냅샷 보관 → 실패 시 복원, §6).
- 모달의 열림/닫힘 상태(`TicketFormModal`, `TicketModal`, `ConfirmDialog`)와 선택된 `ticketId`는 `BoardContainer`가 관리하고 콜백으로 하위에 전달한다. `TicketFormModal`은 `BoardHeader`의 `onNewTicketClick`, `TicketModal`은 `TicketCard`의 `onClick`이 각각 오픈을 트리거하지만 열림 상태 자체는 항상 `BoardContainer`가 소유한다.

---

## 10. 접근성 (NFR-003) 매핑

| 컴포넌트 | 접근성 요소 |
|------|------|
| TicketCard | `role="button"`, `aria-label`, `tabIndex=0`, Enter/Space로 모달 오픈, 드래그는 dnd-kit 키보드 센서 (§6) |
| Column | droppable 영역에 `aria-label="{칼럼명} 칼럼"` |
| PriorityBadge | 텍스트로 우선순위 노출(아이콘/색상에만 의존하지 않음) |
| OverdueIndicator | `aria-label="지연됨"`, 아이콘 + 텍스트 병행 (색상에만 의존하지 않음) |
| NewTicketButton | `aria-label="새 티켓 생성"` |
| TicketFormModal / TicketModal | `role="dialog"`, `aria-modal="true"`, 오픈 시 첫 입력 필드로 포커스 이동, Esc로 닫기 |
| ConfirmDialog | `role="alertdialog"`, 확인 버튼에 기본 포커스 없음(실수 방지, 취소에 기본 포커스) |
| 색상 대비 | DESIGN_SYSTEM.md 토큰은 WCAG AA 기준(4.5:1) 충족 값 사용 |

---

## 11. 반응형 동작 (NFR-002)

DESIGN_SYSTEM.md §5 브레이크포인트 기준.

| 브레이크포인트 | Board 배치 | 비고 |
|------|------|------|
| 모바일 (360px~) | `COLUMN_ORDER` 순서로 4개 `Column` 세로 스크롤 | BACKLOG 포함 별도 탭/토글 없음, 터치 드래그로 이동 (dnd-kit 포인터 센서) |
| 태블릿 (`md:` 768px~) | 2칼럼 그리드 | BACKLOG + TODO를 1행, IN_PROGRESS + DONE을 2행 배치 |
| 데스크톱 (`lg:` 1024px~) | 좌측 사이드바(BACKLOG) + 우측 3칼럼 가로 배치 | `docs/reference/image/tika-wireframe.png` 기준 |
