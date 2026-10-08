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

// dnd-kit 연결(droppable, SortableContext)은 Board를 만드는 P4에서 추가한다
export const Column = ({ status, tickets, onTicketClick }: ColumnProps) => {
  const isBacklog = status === TICKET_STATUS.BACKLOG;
  const label = COLUMN_LABELS[status];

  return (
    <section aria-label={`${label} 칼럼`} className={isBacklog ? "column column--backlog" : "column"}>
      <ColumnHeader label={label} count={tickets.length} showCount={!isBacklog} />
      <div className="card-list">
        {tickets.length === 0 ? (
          <EmptyColumnState label="아직 카드가 없어요" />
        ) : (
          tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onClick={onTicketClick} />)
        )}
      </div>
      {status === TICKET_STATUS.DONE && <p className="column-note">24시간 지난 완료 항목은 표시되지 않아요</p>}
    </section>
  );
};
