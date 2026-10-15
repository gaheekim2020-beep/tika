import type { TicketWithMeta, UpdateTicketInput } from "@/shared/types";

const EDITABLE_FIELDS = ["title", "description", "priority", "plannedStartDate", "dueDate"] as const;

/** 원본 티켓과 비교해 값이 바뀐 필드만 골라 PATCH 본문을 만든다 (Partial Update) */
export const getChangedFields = (original: TicketWithMeta, values: UpdateTicketInput): UpdateTicketInput =>
  EDITABLE_FIELDS.reduce<UpdateTicketInput>((changed, field) => {
    if (field in values && values[field] !== original[field]) {
      return { ...changed, [field]: values[field] };
    }
    return changed;
  }, {});
