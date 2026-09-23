/** @jest-environment node */
import { calculateIsOverdue, getNextBacklogPosition } from "@/server/services/ticketService";
import { db } from "@/server/db/client";
import { tickets } from "@/server/db/schema";
import { TICKET_STATUS } from "@/shared/types";

describe("ticketService", () => {
  afterEach(async () => {
    await db.delete(tickets);
  });

  afterAll(async () => {
    await db.delete(tickets);
  });

  describe("getNextBacklogPosition", () => {
    it("BACKLOG 칼럼이 비어 있으면 1024를 반환한다 (TC-API-001-03)", async () => {
      const position = await getNextBacklogPosition();
      expect(position).toBe(1024);
    });

    it("기존 최솟값이 0이면 새 티켓은 -1024가 된다 (TC-API-001-04)", async () => {
      await db.insert(tickets).values({
        title: "기존 티켓",
        status: TICKET_STATUS.BACKLOG,
        position: 0,
      });

      const position = await getNextBacklogPosition();
      expect(position).toBe(-1024);
    });
  });

  describe("calculateIsOverdue", () => {
    it("DONE 상태면 dueDate가 과거여도 false를 반환한다", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(calculateIsOverdue(TICKET_STATUS.DONE, pastDate)).toBe(false);
    });

    it("dueDate가 null이면 false를 반환한다", () => {
      expect(calculateIsOverdue(TICKET_STATUS.BACKLOG, null)).toBe(false);
    });

    it("DONE이 아니고 dueDate가 과거면 true를 반환한다", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(calculateIsOverdue(TICKET_STATUS.BACKLOG, pastDate)).toBe(true);
    });
  });
});
