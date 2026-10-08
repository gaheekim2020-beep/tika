import type { KeyboardEvent } from "react";
import { TICKET_STATUS, type TicketWithMeta } from "@/shared/types";
import { OverdueIndicator } from "./OverdueIndicator";
import { PriorityBadge } from "./PriorityBadge";

type TicketCardProps = {
  ticket: TicketWithMeta;
  /** 카드 클릭(또는 Enter) 시 상세 모달을 연다 */
  onClick: (ticket: TicketWithMeta) => void;
};

const formatDue = (dueDate: string) => `종료예정 ${dueDate.slice(5)}`;

// dnd-kit 연결(draggable, DragOverlay)은 Board를 만드는 P4에서 추가한다
export const TicketCard = ({ ticket, onClick }: TicketCardProps) => {
  // Space는 드래그 픽업 전용이라 Enter만 상세 모달을 연다 (D6)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") onClick(ticket);
  };

  const className = [
    "card",
    ticket.isOverdue && "card--overdue",
    ticket.status === TICKET_STATUS.DONE && "card--done",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title}, 우선순위 ${ticket.priority}${ticket.isOverdue ? ", 지연됨" : ""}`}
      className={className}
      onClick={() => onClick(ticket)}
      onKeyDown={handleKeyDown}
    >
      <p className="card-title">{ticket.title}</p>
      {ticket.description && <p className="card-desc">{ticket.description}</p>}
      <div className="card-meta">
        <PriorityBadge priority={ticket.priority} />
        {ticket.isOverdue && <OverdueIndicator />}
      </div>
      {ticket.dueDate && (
        <p className={ticket.isOverdue ? "card-due card-due--overdue" : "card-due"}>{formatDue(ticket.dueDate)}</p>
      )}
    </div>
  );
};
