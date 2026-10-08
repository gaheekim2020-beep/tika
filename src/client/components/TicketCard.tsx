import type { CSSProperties, KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TICKET_STATUS, type TicketWithMeta } from "@/shared/types";
import { OverdueIndicator } from "./OverdueIndicator";
import { PriorityBadge } from "./PriorityBadge";

type TicketCardProps = {
  ticket: TicketWithMeta;
  /** 카드 클릭(또는 Enter) 시 상세 모달을 연다 */
  onClick: (ticket: TicketWithMeta) => void;
  /** DragOverlay 미리보기로 쓸 때 true — 드래그 대상으로 등록하지 않는다 */
  isOverlay?: boolean;
};

const formatDue = (dueDate: string) => `종료예정 ${dueDate.slice(5)}`;

const buildLabel = ({ title, priority, isOverdue }: TicketWithMeta) =>
  `${title}, 우선순위 ${priority}${isOverdue ? ", 지연됨" : ""}`;

const buildClassName = (ticket: TicketWithMeta, ...extra: string[]) =>
  [
    "card",
    ticket.isOverdue && "card--overdue",
    ticket.status === TICKET_STATUS.DONE && "card--done",
    ...extra,
  ]
    .filter(Boolean)
    .join(" ");

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

const SortableCard = ({ ticket, onClick }: Omit<TicketCardProps, "isOverlay">) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });

  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  // Space는 dnd-kit 키보드 센서의 픽업 키라 건드리지 않고, Enter만 상세 모달을 연다 (D6)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event);
    if (event.key === "Enter") onClick(ticket);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={() => onClick(ticket)}
      aria-label={buildLabel(ticket)}
      className={buildClassName(ticket, isDragging ? "card--dragging" : "")}
    >
      <CardContent ticket={ticket} />
    </div>
  );
};

export const TicketCard = ({ ticket, onClick, isOverlay = false }: TicketCardProps) =>
  isOverlay ? (
    // 같은 id가 두 번 등록되지 않도록 useSortable을 쓰지 않고, 보조 기술에는 숨긴다
    <div aria-hidden="true" className={buildClassName(ticket, "card--overlay")}>
      <CardContent ticket={ticket} />
    </div>
  ) : (
    <SortableCard ticket={ticket} onClick={onClick} />
  );
