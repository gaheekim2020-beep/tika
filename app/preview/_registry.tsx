import type { ReactNode } from "react";
import { phase2Sections } from "./_sections/phase2";
import { phase3Sections } from "./_sections/phase3";

/*
 * 프리뷰 레지스트리 — /preview 갤러리에 보여줄 컴포넌트 목록.
 *
 * Phase 개발이 끝날 때마다 해당 Phase 파일(`_sections/phaseN.tsx`)을 만들어 아래 `previewSections`에
 * 펼쳐 넣는다 (docs/FRONTEND_TASKS.md §1.5). Phase 1(데이터 계층)은 화면이 없어 프리뷰 대상이 아니다.
 *
 * 항목 예시:
 *
 *   {
 *     id: "button",
 *     phase: "P2",
 *     title: "Button",
 *     spec: "COMPONENT_SPEC §8.8 · TC-COMP-009-04~07",
 *     note: "확인할 점을 한 줄로",
 *     render: () => <ButtonDemo />,
 *   },
 *
 * 모달·토스트처럼 화면 전체를 덮는 컴포넌트는 `contained: true`로 두면 갤러리 패널 안에 가둔다.
 * 상태가 필요한 데모(열기/닫기 등)는 `render`가 데모 컴포넌트를 돌려주게 한다.
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

export const previewSections: PreviewSectionDef[] = [...phase2Sections, ...phase3Sections];
