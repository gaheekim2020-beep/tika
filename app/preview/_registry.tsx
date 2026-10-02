import type { ReactNode } from "react";

/*
 * 프리뷰 레지스트리 — /preview 갤러리에 보여줄 컴포넌트 목록.
 *
 * Phase 개발이 끝날 때마다 `previewSections`에 항목을 추가한다 (docs/FRONTEND_TASKS.md §1.5).
 * Phase 1(데이터 계층)은 화면이 없어 프리뷰 대상이 아니다.
 *
 * 예시 (Phase 2에서 Button을 만든 뒤):
 *
 *   {
 *     id: "button",
 *     phase: "P2",
 *     title: "Button",
 *     spec: "COMPONENT_SPEC §8.8 · TC-COMP-009-04~07",
 *     render: () => (
 *       <div className="flex gap-2">
 *         <Button variant="primary">primary</Button>
 *         <Button variant="secondary">secondary</Button>
 *       </div>
 *     ),
 *   },
 *
 * 모달·토스트처럼 화면 전체를 덮는 컴포넌트는 `contained: true`로 두면 갤러리 패널 안에 가둔다.
 */

export const PREVIEW_PHASES = [
  { id: "P2", label: "Phase 2", title: "UI primitive · 말단 컴포넌트" },
  { id: "P3", label: "Phase 3", title: "카드 · 칼럼" },
  { id: "P4", label: "Phase 4", title: "보드 (DnD)" },
  { id: "P5", label: "Phase 5", title: "폼 · 모달" },
  { id: "P6", label: "Phase 6", title: "헤더 · 컨테이너" },
] as const;

export type PreviewPhaseId = (typeof PREVIEW_PHASES)[number]["id"];

export interface PreviewSectionDef {
  /** 섹션을 구분하는 고유 id (예: "button") */
  id: string;
  phase: PreviewPhaseId;
  title: string;
  /** 관련 명세·TC 번호 (예: "COMPONENT_SPEC §8.8 · TC-COMP-009-04") */
  spec?: string;
  /** 사람이 확인할 때 참고할 한 줄 설명 */
  note?: string;
  /** 모달·토스트처럼 화면 전체를 덮는 컴포넌트를 패널 안에 가둔다 */
  contained?: boolean;
  render: () => ReactNode;
}

export const previewSections: PreviewSectionDef[] = [];
