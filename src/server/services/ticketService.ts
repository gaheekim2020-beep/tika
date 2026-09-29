import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets, type TicketRow } from "@/server/db/schema";
import {
  COLUMN_ORDER,
  TICKET_STATUS,
  type BoardData,
  type CreateTicketInput,
  type TicketStatus,
  type TicketWithMeta,
} from "@/shared/types";

const DONE_VISIBLE_WINDOW_MS = 24 * 60 * 60 * 1000;

function toTicketWithMeta(row: TicketRow): TicketWithMeta {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TicketStatus,
    priority: row.priority as TicketWithMeta["priority"],
    position: row.position,
    plannedStartDate: row.plannedStartDate
      ? row.plannedStartDate.toISOString().slice(0, 10)
      : null,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOverdue: calculateIsOverdue(row.status as TicketStatus, row.dueDate),
  };
}

export async function getNextBacklogPosition(): Promise<number> {
  const [lowest] = await db
    .select({ position: tickets.position })
    .from(tickets)
    .where(eq(tickets.status, TICKET_STATUS.BACKLOG))
    .orderBy(asc(tickets.position))
    .limit(1);

  if (!lowest) {
    return 1024;
  }
  return lowest.position - 1024;
}

export function calculateIsOverdue(
  status: TicketStatus,
  dueDate: Date | null
): boolean {
  if (status === TICKET_STATUS.DONE || dueDate === null) {
    return false;
  }
  return dueDate < new Date();
}

export async function createTicket(
  input: CreateTicketInput
): Promise<TicketWithMeta> {
  const position = await getNextBacklogPosition();

  const [row] = await db
    .insert(tickets)
    .values({
      title: input.title,
      description: input.description ?? null,
      status: TICKET_STATUS.BACKLOG,
      priority: input.priority ?? "MEDIUM",
      position,
      plannedStartDate: input.plannedStartDate
        ? new Date(input.plannedStartDate)
        : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    })
    .returning();

  return toTicketWithMeta(row);
}

export async function getTicketById(id: number): Promise<TicketWithMeta | null> {
  const [row] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return row ? toTicketWithMeta(row) : null;
}

export async function getBoardData(): Promise<BoardData> {
  const rows = await db
    .select()
    .from(tickets)
    .orderBy(asc(tickets.status), asc(tickets.position));

  const board = COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = [];
    return acc;
  }, {} as BoardData);

  const doneVisibleAfter = new Date(Date.now() - DONE_VISIBLE_WINDOW_MS);

  for (const row of rows) {
    const status = row.status as TicketStatus;

    if (
      status === TICKET_STATUS.DONE &&
      (row.completedAt === null || row.completedAt < doneVisibleAfter)
    ) {
      continue;
    }

    board[status].push(toTicketWithMeta(row));
  }

  return board;
}
