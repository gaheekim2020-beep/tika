/** @jest-environment node */
import {
  calculateIsOverdue,
  getBoardData,
  getNextBacklogPosition,
  getTicketById,
  updateTicket,
} from "@/server/services/ticketService";
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

  describe("getBoardData", () => {
    // TC-API-002-01: 4개 상태에 티켓이 골고루 있는 상태에서 조회
    it("4개 상태에 티켓이 하나 이상씩 있으면 4개 키로 그룹화되어 반환한다", async () => {
      await db.insert(tickets).values([
        { title: "백로그 티켓", status: TICKET_STATUS.BACKLOG, position: 1024 },
        { title: "투두 티켓", status: TICKET_STATUS.TODO, position: 1024 },
        { title: "진행중 티켓", status: TICKET_STATUS.IN_PROGRESS, position: 1024 },
        {
          title: "완료 티켓",
          status: TICKET_STATUS.DONE,
          position: 1024,
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);

      const board = await getBoardData();

      expect(board.BACKLOG).toHaveLength(1);
      expect(board.TODO).toHaveLength(1);
      expect(board.IN_PROGRESS).toHaveLength(1);
      expect(board.DONE).toHaveLength(1);
      expect(board.BACKLOG[0].title).toBe("백로그 티켓");
    });

    // TC-API-002-02: 같은 칼럼 내 여러 티켓 조회
    it("같은 칼럼 내 티켓은 position 오름차순으로 정렬된다", async () => {
      await db.insert(tickets).values([
        { title: "세번째", status: TICKET_STATUS.BACKLOG, position: 300 },
        { title: "첫번째", status: TICKET_STATUS.BACKLOG, position: 100 },
        { title: "두번째", status: TICKET_STATUS.BACKLOG, position: 200 },
      ]);

      const board = await getBoardData();

      expect(board.BACKLOG.map((t) => t.title)).toEqual([
        "첫번째",
        "두번째",
        "세번째",
      ]);
    });

    // TC-API-002-03: 티켓이 하나도 없는 상태에서 조회
    it("티켓이 하나도 없으면 4개 키 모두 빈 배열을 반환한다", async () => {
      const board = await getBoardData();

      expect(board).toEqual({
        BACKLOG: [],
        TODO: [],
        IN_PROGRESS: [],
        DONE: [],
      });
    });

    // TC-API-002-04/05: DONE 24시간 필터
    it("completedAt이 24시간 이내인 DONE 티켓은 포함되고, 초과한 티켓은 제외된다", async () => {
      await db.insert(tickets).values([
        {
          title: "최근 완료",
          status: TICKET_STATUS.DONE,
          position: 100,
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        {
          title: "오래된 완료",
          status: TICKET_STATUS.DONE,
          position: 200,
          completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]);

      const board = await getBoardData();

      expect(board.DONE.map((t) => t.title)).toEqual(["최근 완료"]);
    });
  });

  describe("getTicketById", () => {
    // TC-API-003-01: 존재하는 티켓 ID 조회
    it("존재하는 id로 조회하면 전체 필드와 isOverdue를 포함해 반환한다", async () => {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "상세 조회 티켓",
          status: TICKET_STATUS.BACKLOG,
          position: 1024,
        })
        .returning();

      const ticket = await getTicketById(row.id);

      expect(ticket).not.toBeNull();
      expect(ticket?.id).toBe(row.id);
      expect(ticket?.title).toBe("상세 조회 티켓");
      expect(ticket?.isOverdue).toBe(false);
    });

    // TC-API-003-02: 완료된 지 24시간이 지난 DONE 티켓도 상세 조회는 성공해야 한다
    it("completedAt이 24시간을 초과한 DONE 티켓도 정상적으로 반환한다", async () => {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "오래된 완료 티켓",
          status: TICKET_STATUS.DONE,
          position: 1024,
          completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        })
        .returning();

      const ticket = await getTicketById(row.id);

      expect(ticket).not.toBeNull();
      expect(ticket?.title).toBe("오래된 완료 티켓");
    });

    // TC-API-003-05: 존재하지 않는 ID 조회
    it("존재하지 않는 id로 조회하면 null을 반환한다", async () => {
      const ticket = await getTicketById(999999);
      expect(ticket).toBeNull();
    });
  });

  describe("updateTicket", () => {
    async function insertFullTicket(overrides: Partial<typeof tickets.$inferInsert> = {}) {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "원래 제목",
          description: "원래 설명",
          status: TICKET_STATUS.TODO,
          priority: "HIGH",
          position: 2048,
          plannedStartDate: new Date("2026-10-01"),
          dueDate: new Date("2099-12-31"),
          updatedAt: new Date(Date.now() - 60 * 1000),
          ...overrides,
        })
        .returning();
      return row;
    }

    it("제목만 수정하면 제목만 바뀌고 나머지 필드는 유지된다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, { title: "수정된 제목" });

      expect(ticket).toMatchObject({
        id: row.id,
        title: "수정된 제목",
        description: "원래 설명",
        priority: "HIGH",
        status: TICKET_STATUS.TODO,
        position: 2048,
        plannedStartDate: "2026-10-01",
        dueDate: "2099-12-31",
      });
    });

    it("여러 필드를 동시에 수정하면 전달한 필드가 모두 반영된다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, {
        title: "새 제목",
        description: "새 설명",
        priority: "LOW",
        plannedStartDate: "2026-11-01",
        dueDate: "2099-11-30",
      });

      expect(ticket).toMatchObject({
        title: "새 제목",
        description: "새 설명",
        priority: "LOW",
        plannedStartDate: "2026-11-01",
        dueDate: "2099-11-30",
      });
    });

    it("수정하면 updatedAt이 수정 전보다 이후 시각으로 갱신된다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, { title: "수정된 제목" });

      expect(ticket?.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    });

    it("종료예정일을 과거로 수정하면 미완료 티켓의 isOverdue가 true로 재계산된다", async () => {
      const row = await insertFullTicket();
      expect((await getTicketById(row.id))?.isOverdue).toBe(false);

      const ticket = await updateTicket(row.id, { dueDate: "2020-01-01" });

      expect(ticket?.dueDate).toBe("2020-01-01");
      expect(ticket?.isOverdue).toBe(true);
    });

    it("DONE 티켓을 수정해도 status와 completedAt은 유지된다", async () => {
      const completedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const row = await insertFullTicket({
        status: TICKET_STATUS.DONE,
        completedAt,
      });

      const ticket = await updateTicket(row.id, { title: "완료 후 수정" });

      expect(ticket?.title).toBe("완료 후 수정");
      expect(ticket?.status).toBe(TICKET_STATUS.DONE);
      expect(ticket?.completedAt?.getTime()).toBe(completedAt.getTime());
    });

    it("description을 null로 전달하면 설명이 비워진다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, { description: null });

      expect(ticket?.description).toBeNull();
      expect(ticket?.title).toBe("원래 제목");
    });

    it("plannedStartDate를 null로 전달하면 시작예정일이 비워진다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, { plannedStartDate: null });

      expect(ticket?.plannedStartDate).toBeNull();
      expect(ticket?.dueDate).toBe("2099-12-31");
    });

    it("dueDate를 null로 전달하면 종료예정일이 비워지고 isOverdue가 false로 재계산된다", async () => {
      const row = await insertFullTicket({ dueDate: new Date("2020-01-01") });
      expect((await getTicketById(row.id))?.isOverdue).toBe(true);

      const ticket = await updateTicket(row.id, { dueDate: null });

      expect(ticket?.dueDate).toBeNull();
      expect(ticket?.isOverdue).toBe(false);
    });

    it("빈 입력이면 기존 값은 그대로이고 updatedAt만 갱신된다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(row.id, {});

      expect(ticket).toMatchObject({
        title: "원래 제목",
        description: "원래 설명",
        priority: "HIGH",
        plannedStartDate: "2026-10-01",
        dueDate: "2099-12-31",
      });
      expect(ticket?.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    });

    it("존재하지 않는 id면 null을 반환하고 다른 티켓은 변경되지 않는다", async () => {
      const row = await insertFullTicket();

      const ticket = await updateTicket(999999, { title: "없는 티켓 수정" });

      expect(ticket).toBeNull();
      expect((await getTicketById(row.id))?.title).toBe("원래 제목");
    });
  });
});

afterAll(async () => {
  await db.$client.end();
});
