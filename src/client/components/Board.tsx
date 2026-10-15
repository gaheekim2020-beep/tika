import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  COLUMN_ORDER,
  type BoardData,
  type ReorderableStatus,
  type TicketStatus,
  type TicketWithMeta,
} from "@/shared/types";
import { boardCollisionDetection } from "@/client/lib/boardCollision";
import { findTicket, getDropStatus, resolveDropTarget } from "@/client/lib/boardUtils";
import { Column } from "./Column";
import { TicketCardOverlay } from "./TicketCard";

type BoardProps = {
  board: BoardData;
  onTicketClick: (ticket: TicketWithMeta) => void;
  /** 대상이 BACKLOG/TODO/IN_PROGRESS일 때 (useTickets.reorder 위임) */
  onReorder: (ticketId: number, status: ReorderableStatus, position: number) => void;
  /** 대상이 DONE일 때 (useTickets.complete 위임) */
  onComplete: (ticketId: number) => void;
};

// DndContext에 id를 주지 않으면 aria-describedby(DndDescribedBy-N)가 서버·클라이언트에서 달라 hydration 오류가 난다
const DND_CONTEXT_ID = "board-dnd";

export const Board = ({ board, onTicketClick, onReorder, onComplete }: BoardProps) => {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<TicketStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      // Enter는 카드의 상세 열기에 쓰므로 픽업(start)은 Space만. 나머지는 dnd-kit 기본값 (TRD §1.5, D6)
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
      },
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTicket = activeId === null ? undefined : findTicket(board, activeId);

  const resetDrag = () => {
    setActiveId(null);
    setOverStatus(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverStatus(getDropStatus(board, event.over?.id ?? null));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    resetDrag();

    const ticketId = Number(event.active.id);
    const target = resolveDropTarget(board, ticketId, event.over?.id ?? null, {
      // 충돌 감지(boardCollision)가 포인터 위치로 판단한 "대상 카드의 뒤에 놓았는지"
      placeAfter: event.collisions?.[0]?.data?.placeAfter === true,
    });
    if (!target) return;

    if (target.kind === "complete") {
      onComplete(ticketId);
    } else {
      onReorder(ticketId, target.status, target.position);
    }
  };

  return (
    <DndContext
      id={DND_CONTEXT_ID}
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      <div className="board">
        {COLUMN_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={board[status]}
            onTicketClick={onTicketClick}
            isOver={overStatus === status}
          />
        ))}
      </div>
      <DragOverlay>{activeTicket ? <TicketCardOverlay ticket={activeTicket} /> : null}</DragOverlay>
    </DndContext>
  );
};
