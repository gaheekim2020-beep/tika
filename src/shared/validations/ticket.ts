import { z } from "zod";
import { TICKET_PRIORITY } from "@/shared/types";

function isTodayOrAfter(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateStr}T00:00:00`);
  return date >= today;
}

export const createTicketSchema = z.object({
  title: z
    .string({ message: "제목을 입력해주세요" })
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(200, "제목은 200자 이내로 입력해주세요"),
  description: z
    .string()
    .max(1000, "설명은 1000자 이내로 입력해주세요")
    .optional(),
  priority: z
    .enum([TICKET_PRIORITY.LOW, TICKET_PRIORITY.MEDIUM, TICKET_PRIORITY.HIGH], {
      message: "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요",
    })
    .default(TICKET_PRIORITY.MEDIUM),
  plannedStartDate: z.string().date().optional(),
  dueDate: z
    .string()
    .date()
    .optional()
    .refine((value) => value === undefined || isTodayOrAfter(value), {
      message: "종료예정일은 오늘 이후 날짜를 선택해주세요",
    }),
});

// CreateTicketInput 타입은 src/shared/types에서 정의한다 (constitution 원칙 I).
// 이 스키마는 그 타입과 형태가 일치하도록 유지한다.
