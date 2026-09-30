import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets, type NewTicketRow, type TicketRow } from "@/server/db/schema";
import {
  COLUMN_ORDER,
  TICKET_STATUS,
  type BoardData,
  type CreateTicketInput,
  type TicketStatus,
  type TicketWithMeta,
  type UpdateTicketInput,
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

async function getNextTopPosition(status: TicketStatus): Promise<number> {
  const [lowest] = await db
    .select({ position: tickets.position })
    .from(tickets)
    .where(eq(tickets.status, status))
    .orderBy(asc(tickets.position))
    .limit(1);

  if (!lowest) {
    return 1024;
  }
  return lowest.position - 1024;
}

export async function getNextBacklogPosition(): Promise<number> {
  return getNextTopPosition(TICKET_STATUS.BACKLOG);
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

export async function updateTicket(
  id: number,
  input: UpdateTicketInput
): Promise<TicketWithMeta | null> {
  const changes: Partial<NewTicketRow> = {};

  if (input.title !== undefined) changes.title = input.title;
  if (input.description !== undefined) changes.description = input.description;
  if (input.priority !== undefined) changes.priority = input.priority;
  if (input.plannedStartDate !== undefined) {
    changes.plannedStartDate = input.plannedStartDate
      ? new Date(input.plannedStartDate)
      : null;
  }
  if (input.dueDate !== undefined) {
    changes.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }

  // 빈 입력에서도 updatedAt은 갱신되어야 하므로 항상 명시한다
  const [row] = await db
    .update(tickets)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  return row ? toTicketWithMeta(row) : null;
}

export async function completeTicket(id: number): Promise<TicketWithMeta | null> {
  // completedAt은 getBoardData의 24시간 필터와 같은 JS 시각 기준이어야 하므로 DB now()를 쓰지 않는다
  const now = new Date();
  const position = await getNextTopPosition(TICKET_STATUS.DONE);

  // 이미 DONE인 티켓은 갱신 대상에서 빠지므로 동시 요청에도 completedAt/position을 덮어쓰지 않는다
  const [updated] = await db
    .update(tickets)
    .set({
      status: TICKET_STATUS.DONE,
      completedAt: now,
      position,
      updatedAt: now,
    })
    .where(and(eq(tickets.id, id), ne(tickets.status, TICKET_STATUS.DONE)))
    .returning();

  if (updated) {
    return toTicketWithMeta(updated);
  }

  // 갱신된 행이 없으면 티켓이 없거나 이미 DONE이다
  return getTicketById(id);
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
