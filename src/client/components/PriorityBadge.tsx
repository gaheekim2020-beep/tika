import { TICKET_PRIORITY, type TicketPriority } from "@/shared/types";
import { Badge, type BadgeVariant } from "./Badge";

type PriorityBadgeProps = {
  priority: TicketPriority;
};

const VARIANT_BY_PRIORITY: Record<TicketPriority, BadgeVariant> = {
  [TICKET_PRIORITY.LOW]: "low",
  [TICKET_PRIORITY.MEDIUM]: "medium",
  [TICKET_PRIORITY.HIGH]: "high",
};

// 색상에만 의존하지 않도록 우선순위를 텍스트로도 보여 준다 (§11)
export const PriorityBadge = ({ priority }: PriorityBadgeProps) => (
  <Badge variant={VARIANT_BY_PRIORITY[priority]}>{priority}</Badge>
);
