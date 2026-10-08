import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { COLUMN_LABELS, TICKET_STATUS, type TicketStatus, type TicketWithMeta } from "@/shared/types";
import { ColumnHeader } from "./ColumnHeader";
import { EmptyColumnState } from "./EmptyColumnState";
import { TicketCard } from "./TicketCard";

type ColumnProps = {
  status: TicketStatus;
  /** 해당 상태의 티켓 목록 (position 오름차순) */
  tickets: TicketWithMeta[];
  onTicketClick: (ticket: TicketWithMeta) => void;
};

/** 칼럼 영역 droppable id — 카드 id(number)와 겹치지 않도록 접두사를 붙인다 */
export const getColumnDroppableId = (status: TicketStatus) => `column:${status}`;

export const Column = ({ status, tickets, onTicketClick }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: getColumnDroppableId(status) });
  const isBacklog = status === TICKET_STATUS.BACKLOG;
  const label = COLUMN_LABELS[status];

  const className = ["column", isBacklog && "column--backlog", isOver && "column--over"].filter(Boolean).join(" ");

  return (
    <section ref={setNodeRef} aria-label={`${label} 칼럼`} className={className}>
      <ColumnHeader label={label} count={tickets.length} showCount={!isBacklog} />
      <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
        <div className="card-list">
          {tickets.length === 0 ? (
            <EmptyColumnState label="아직 카드가 없어요" />
          ) : (
            tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onClick={onTicketClick} />)
          )}
        </div>
      </SortableContext>
      {status === TICKET_STATUS.DONE && <p className="column-note">24시간 지난 완료 항목은 표시되지 않아요</p>}
    </section>
  );
};
