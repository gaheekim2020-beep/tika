import type { KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TICKET_STATUS, type TicketWithMeta } from "@/shared/types";
import { OverdueIndicator } from "./OverdueIndicator";
import { PriorityBadge } from "./PriorityBadge";

type TicketCardProps = {
  ticket: TicketWithMeta;
  /** 카드 클릭(또는 Enter) 시 상세 모달을 연다 */
  onClick: (ticket: TicketWithMeta) => void;
};

const formatDue = (dueDate: string) => `종료예정 ${dueDate.slice(5)}`;

const getClassName = (ticket: TicketWithMeta, ...modifiers: (string | false)[]) =>
  [
    "card",
    ticket.isOverdue && "card--overdue",
    ticket.status === TICKET_STATUS.DONE && "card--done",
    ...modifiers,
  ]
    .filter(Boolean)
    .join(" ");

// 카드 안쪽 표시 내용. 원본 카드와 DragOverlay 미리보기가 같이 쓴다
const CardContent = ({ ticket }: { ticket: TicketWithMeta }) => (
  <>
    <p className="card-title">{ticket.title}</p>
    {ticket.description && <p className="card-desc">{ticket.description}</p>}
    <div className="card-meta">
      <PriorityBadge priority={ticket.priority} />
      {ticket.isOverdue && <OverdueIndicator />}
    </div>
    {ticket.dueDate && (
      <p className={ticket.isOverdue ? "card-due card-due--overdue" : "card-due"}>{formatDue(ticket.dueDate)}</p>
    )}
  </>
);

export const TicketCard = ({ ticket, onClick }: TicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });

  // Space는 드래그 픽업 전용이라 Enter만 상세 모달을 연다 (D6).
  // 드래그 중의 Enter는 "놓기" 키이므로 모달을 열지 않는다.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    (listeners?.onKeyDown as ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined)?.(event);
    if (event.key === "Enter" && !isDragging) onClick(ticket);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title}, 우선순위 ${ticket.priority}${ticket.isOverdue ? ", 지연됨" : ""}`}
      className={getClassName(ticket, isDragging && "card--dragging")}
      onClick={() => onClick(ticket)}
      onKeyDown={handleKeyDown}
    >
      <CardContent ticket={ticket} />
    </div>
  );
};

/**
 * DragOverlay에 그리는 드래그 미리보기. 원본과 같은 id를 useSortable에 중복 등록하지 않으려고
 * dnd 훅 없이 표시만 한다 (그래서 포커스·버튼 역할이 없다).
 */
export const TicketCardOverlay = ({ ticket }: { ticket: TicketWithMeta }) => (
  <div className={getClassName(ticket, "card--overlay")}>
    <CardContent ticket={ticket} />
  </div>
);
