import { useState } from "react";
import { BoardHeader } from "@/client/components/BoardHeader";
import type { PreviewSectionDef } from "../_registry";

/*
 * Phase 6 프리뷰 — 헤더 · 컨테이너.
 * BoardContainer는 서버 호출이 필요해서 프리뷰에 등록하지 않고 실제 앱(`/`)으로 확인한다 (docs/FRONTEND_TASKS.md §1.5 결정).
 */

const BoardHeaderDemo = () => {
  const [clicks, setClicks] = useState(0);

  return (
    <>
      <BoardHeader onNewTicketClick={() => setClicks((count) => count + 1)} />
      <p className="mt-4 text-xs text-text-secondary">[새 업무] 버튼을 누른 횟수: {clicks}</p>
    </>
  );
};

export const phase6Sections: PreviewSectionDef[] = [
  {
    id: "board-header",
    phase: "P6",
    title: "BoardHeader",
    spec: "COMPONENT_SPEC §3.3 · TC-COMP-005-01~03",
    note: "확인: 로고와 검색창이 왼쪽, '새 업무' 버튼이 오른쪽 끝에 있는가, 검색창이 비활성(커서 금지, 입력 불가)인가, 버튼 클릭·Tab 후 Enter/Space로 횟수가 올라가는가, 좁은 폭(모바일)에서 줄바꿈 없이 들어가는가.",
    render: () => <BoardHeaderDemo />,
  },
];
