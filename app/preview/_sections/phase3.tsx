import { useState } from "react";
import { Column } from "@/client/components/Column";
import { ColumnHeader } from "@/client/components/ColumnHeader";
import { TicketCard } from "@/client/components/TicketCard";
import type { TicketWithMeta } from "@/shared/types";
import { longTitleTicket, makeBoard, makeEmptyBoard, makeTicket } from "../_mock/mockData";
import type { PreviewSectionDef } from "../_registry";

/*
 * Phase 3 프리뷰 — 카드 · 칼럼.
 * 드래그앤드롭은 Board(P4)에서 연결하므로 여기서는 표시와 클릭만 확인한다.
 */

const cardSamples: { label: string; ticket: TicketWithMeta }[] = [
  { label: "기본 (설명 없음)", ticket: makeTicket({ id: 1, title: "성능 테스트 계획", priority: "MEDIUM" }) },
  {
    label: "설명 있음 + 종료예정일",
    ticket: makeTicket({
      id: 2,
      title: "로그인 페이지 구현",
      description: "로그인 화면과 검증 로직을 구현한다.",
      priority: "HIGH",
      status: "TODO",
      dueDate: "2026-10-20",
    }),
  },
  {
    label: "지연",
    ticket: makeTicket({
      id: 3,
      title: "대시보드 레이아웃",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "2026-09-03",
      isOverdue: true,
    }),
  },
  {
    label: "DONE (기한 지났어도 지연 표시 없음)",
    ticket: makeTicket({ id: 4, title: "요구사항 정리", priority: "LOW", status: "DONE", dueDate: "2026-09-02" }),
  },
  { label: "200자 제목", ticket: { ...longTitleTicket, id: 5 } },
  {
    label: "1000자 설명",
    ticket: makeTicket({ id: 6, title: "설명이 아주 긴 카드", description: "긴 설명입니다. ".repeat(100), priority: "LOW" }),
  },
];

const TicketCardDemo = () => {
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {cardSamples.map(({ label, ticket }) => (
          <div key={ticket.id} className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-text-secondary">{label}</span>
            <TicketCard ticket={ticket} onClick={(target) => setClicked(target.title.slice(0, 20))} />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-secondary">
        마지막으로 연 카드: {clicked ?? "없음"} (클릭 또는 Tab → Enter. Space로는 열리지 않습니다)
      </p>
    </>
  );
};

const ColumnHeaderDemo = () => (
  <div className="flex max-w-xs flex-col gap-3">
    <ColumnHeader label="In Progress" count={2} />
    <ColumnHeader label="TODO" count={0} />
    <ColumnHeader label="Backlog" count={5} showCount={false} />
  </div>
);

const ColumnDemo = () => {
  const [clicked, setClicked] = useState<string | null>(null);
  const board = makeBoard();
  const sample = [board.BACKLOG, board.TODO, makeEmptyBoard().IN_PROGRESS, board.DONE];
  const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statuses.map((status, index) => (
          <Column
            key={status}
            status={status}
            tickets={sample[index]}
            onTicketClick={(ticket) => setClicked(ticket.title)}
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-text-secondary">마지막으로 연 카드: {clicked ?? "없음"}</p>
    </>
  );
};

export const phase3Sections: PreviewSectionDef[] = [
  {
    id: "column-header",
    phase: "P3",
    title: "ColumnHeader",
    spec: "COMPONENT_SPEC §4.2 · TC-COMP-002-03",
    note: "확인: 라벨과 카드 수 배지가 양끝에 정렬되는가, showCount=false(Backlog)에는 숫자가 없는가.",
    render: () => <ColumnHeaderDemo />,
  },
  {
    id: "ticket-card",
    phase: "P3",
    title: "TicketCard",
    spec: "COMPONENT_SPEC §5.1 · TC-COMP-001-01~15",
    note: "확인: 지연 카드의 빨간 테두리·배지·날짜 색, DONE 카드의 흐린 표시, 긴 제목 2줄 말줄임(001-07), 긴 설명 2줄 말줄임(001-14), Tab 포커스 링.",
    render: () => <TicketCardDemo />,
  },
  {
    id: "column",
    phase: "P3",
    title: "Column",
    spec: "COMPONENT_SPEC §4.1 · TC-COMP-002-01~06",
    note: "확인: Backlog만 배경이 다르고 숫자가 없는가, 빈 칼럼의 점선 안내, Done 하단의 24시간 안내 문구, 카드 간격.",
    render: () => <ColumnDemo />,
  },
];
