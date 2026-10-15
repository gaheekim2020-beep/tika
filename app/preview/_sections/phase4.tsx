import { useState } from "react";
import { Board } from "@/client/components/Board";
import { Button } from "@/client/components/Button";
import { completeInBoard, moveTicket } from "@/client/lib/boardUtils";
import type { BoardData, ReorderableStatus } from "@/shared/types";
import { makeBoard, makeEmptyBoard } from "../_mock/mockData";
import type { PreviewSectionDef } from "../_registry";

/*
 * Phase 4 프리뷰 — 보드 (DnD).
 * API 없이 onReorder/onComplete를 받아 boardUtils의 낙관적 반영 함수로 화면만 갱신한다.
 * (실제 앱에서는 BoardContainer가 useTickets로 같은 일을 하고 서버 응답으로 확정한다.)
 */

const BoardDemo = () => {
  const [board, setBoard] = useState<BoardData>(makeBoard);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);

  const handleReorder = (ticketId: number, status: ReorderableStatus, position: number) => {
    setBoard((current) => moveTicket(current, ticketId, status, position));
    setLastEvent(`onReorder(${ticketId}, "${status}", ${position})`);
  };

  const handleComplete = (ticketId: number) => {
    setBoard((current) => completeInBoard(current, ticketId));
    setLastEvent(`onComplete(${ticketId})`);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setBoard(makeBoard());
            setLastEvent(null);
          }}
        >
          샘플 보드로 초기화
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setBoard(makeEmptyBoard());
            setLastEvent(null);
          }}
        >
          빈 보드로 전환
        </Button>
      </div>
      <Board
        board={board}
        onTicketClick={(ticket) => setClicked(ticket.title)}
        onReorder={handleReorder}
        onComplete={handleComplete}
      />
      <dl className="mt-4 grid gap-1 text-xs text-text-secondary">
        <div>
          <dt className="inline font-bold">마지막 이벤트: </dt>
          <dd className="inline font-mono">{lastEvent ?? "없음"}</dd>
        </div>
        <div>
          <dt className="inline font-bold">마지막으로 연 카드: </dt>
          <dd className="inline">{clicked ?? "없음"}</dd>
        </div>
      </dl>
    </>
  );
};

export const phase4Sections: PreviewSectionDef[] = [
  {
    id: "board",
    phase: "P4",
    title: "Board",
    spec: "COMPONENT_SPEC §3.4·§7 · TC-COMP-003-01~07, 11, 13~16",
    note: "확인: 카드를 8px 이상 끌면 미리보기(기울어진 카드)가 따라오고 원래 자리가 흐려지는가, 올라간 칼럼이 강조되는가, 칼럼 빈 영역에 놓으면 맨 뒤로 가는가, 빈 칼럼에도 놓을 수 있는가, DONE으로 놓으면 맨 위로 가고 DONE 안에서는 제자리로 돌아오는가. Tab → Space → 방향키 → Space로 키보드 이동(Esc 취소), 클릭·Enter는 카드 열기.",
    render: () => <BoardDemo />,
  },
];
