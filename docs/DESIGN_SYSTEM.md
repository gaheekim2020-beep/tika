# Tika - 디자인 시스템 (DESIGN_SYSTEM.md)

> 버전: 1.0 (MVP, 라이트 모드만 지원)
> 컬러 토큰 정의(참조용 원본): `src/shared/design/colors.json`
> CSS 변수(런타임): `app/globals.css` `:root`
> 컴포넌트 구현 시 이 문서와 두 파일을 함께 참조한다. 컬러 변경 시 `colors.json`과 `globals.css`를 함께 업데이트한다.

---

## 1. 컬러 토큰

`colors.json`의 키를 그대로 옮긴 표. 실제 값은 `colors.json`을 단일 진실 공급원으로 삼는다.

### 배경 / 테두리 / 텍스트

| 토큰 | CSS 변수 | 값 | 용도 |
|------|----------|-----|------|
| background.page | `--color-bg-page` | `#F9FAFB` | 페이지 전체 배경 |
| background.surface | `--color-bg-surface` | `#FFFFFF` | 카드, 모달 등 표면 |
| background.sidebar | `--color-bg-sidebar` | `#F3F4F6` | Backlog 사이드바 배경 |
| border.default | `--color-border-default` | `#E5E7EB` | 카드/칼럼 기본 테두리 |
| border.strong | `--color-border-strong` | `#D1D5DB` | 강조 테두리 (포커스, hover) |
| text.primary | `--color-text-primary` | `#111827` | 본문/제목 텍스트 |
| text.secondary | `--color-text-secondary` | `#6B7280` | 설명, 보조 텍스트 |
| text.placeholder | `--color-text-placeholder` | `#9CA3AF` | placeholder, 비활성 텍스트 |
| text.inverse | `--color-text-inverse` | `#FFFFFF` | 어두운 배경 위 텍스트 |

### 브랜드

| 토큰 | CSS 변수 | 값 | 용도 |
|------|----------|-----|------|
| brand.primary | `--color-brand-primary` | `#4F46E5` | 주요 버튼("+ 새 티켓"), 링크, 포커스 링 |
| brand.primaryHover | `--color-brand-primary-hover` | `#4338CA` | 주요 버튼 hover |

### 우선순위 뱃지 (FR-001, US-002)

| 우선순위 | 배경 | 텍스트 | CSS 변수 |
|------|------|------|------|
| LOW | `#F3F4F6` | `#4B5563` | `--color-priority-low-bg` / `--color-priority-low-text` |
| MEDIUM | `#DBEAFE` | `#1D4ED8` | `--color-priority-medium-bg` / `--color-priority-medium-text` |
| HIGH | `#FEE2E2` | `#B91C1C` | `--color-priority-high-bg` / `--color-priority-high-text` |

### 상태 (Overdue / 위험 / 성공)

| 토큰 | 값 | 용도 |
|------|-----|------|
| status.overdue.bg / text / border | `#FEF2F2` / `#DC2626` / `#FCA5A5` | Overdue 카드 강조 (FR-008, US-004) |
| status.danger.bg / text | `#FEE2E2` / `#B91C1C` | 삭제 버튼, 위험 액션 |
| status.success.bg / text | `#DCFCE7` / `#15803D` | 완료(Done) 관련 표시 |

> `priority.high`와 `status.danger`는 값이 동일하지만 의미가 다르므로(우선순위 vs 위험 액션) 토큰을 분리해 둔다. 향후 값이 갈라져도 서로 영향을 주지 않는다.

### Overdue 카드 표시 규칙 (FR-008, US-004)

`isOverdue === true`인 카드는 다음 두 요소를 함께 적용해 표시한다 (색상에만 의존하지 않도록 배지에 텍스트를 병행한다 — NFR-003 접근성).

| 요소 | 적용 |
|------|------|
| 카드 테두리 | 기본 `border.default` 대신 `status.overdue.border`(`#FCA5A5`)로 전체 테두리 강조 |
| 배지 | 카드 상단에 `status.overdue.bg`/`status.overdue.text` 색상의 "지연" 텍스트 배지 추가 |

일반 카드와 Overdue 카드는 테두리 색상 + 배지 유무 두 가지로 구분되며, 배경색 전체를 바꾸지는 않는다 (카드 내 다른 정보의 대비를 해치지 않기 위함).

---

## 2. 간격 (Spacing)

Tailwind 기본 스케일을 그대로 사용한다 (별도 커스텀 스케일 없음).

| 용도 | Tailwind 클래스 | 값 |
|------|------|-----|
| 카드 내부 패딩 | `p-3` | 12px |
| 카드 간 세로 간격 | `gap-2` | 8px |
| 칼럼 내부 패딩 | `p-4` | 16px |
| 칼럼 간 가로 간격 | `gap-4` | 16px |
| 섹션(사이드바/보드) 간 간격 | `gap-6` | 24px |

---

## 3. 그림자 & 라운딩

| 용도 | Tailwind 클래스 |
|------|------|
| 카드 기본 | `rounded-lg` (8px), `shadow-sm` |
| 카드 드래그 중 (DragOverlay) | `shadow-lg` |
| 모달 | `rounded-xl` (12px), `shadow-lg` |
| 버튼 | `rounded-md` (6px) |

---

## 4. 다크 모드

MVP 범위에 다크 모드 요구사항이 없으므로 **라이트 모드만 지원**한다 (PRD.md 2차 스펙 논의 대상).

---

## 5. 반응형 브레이크포인트

NFR-002 기준, Tailwind 기본 브레이크포인트를 그대로 사용한다.

| 브레이크포인트 | 값 | 레이아웃 |
|------|------|------|
| 기본 (모바일) | `360px~` | 단일 칼럼 세로 스크롤 |
| `md:` | `768px~` | 2칼럼 그리드 |
| `lg:` | `1024px~` | 4칼럼 가로 배치 (사이드바 + 3컬럼) |

> 컴포넌트별 반응형 적용 방식은 COMPONENT_SPEC.md에서 다룬다.
