import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("BACKLOG"),
    priority: varchar("priority", { length: 10 }).notNull().default("MEDIUM"),
    position: integer("position").notNull().default(1),
    plannedStartDate: date("planned_start_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_tickets_status_position").on(table.status, table.position),
    index("idx_tickets_due_date").on(table.dueDate),
    index("idx_tickets_completed_at").on(table.completedAt),
  ]
);

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
