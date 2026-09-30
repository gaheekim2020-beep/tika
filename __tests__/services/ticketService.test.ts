/** @jest-environment node */
import {
  calculateIsOverdue,
  completeTicket,
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

  describe("completeTicket", () => {
    async function insertTicket(overrides: Partial<typeof tickets.$inferInsert> = {}) {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "완료할 티켓",
          description: "원래 설명",
          status: TICKET_STATUS.TODO,
          priority: "HIGH",
          position: 2048,
          plannedStartDate: new Date("2026-10-01"),
          dueDate: new Date("2099-12-31"),
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 60 * 1000),
          ...overrides,
        })
        .returning();
      return row;
    }

    it("TODO 티켓을 완료하면 DONE이 되고 completedAt이 요청 전후 시각 사이이며 updatedAt과 같다", async () => {
      const row = await insertTicket();

      const before = new Date();
      const ticket = await completeTicket(row.id);
      const after = new Date();

      expect(ticket?.status).toBe(TICKET_STATUS.DONE);
      expect(ticket?.completedAt).not.toBeNull();
      expect(ticket!.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ticket!.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(ticket?.updatedAt.getTime()).toBe(ticket!.completedAt!.getTime());
      expect(ticket?.isOverdue).toBe(false);
    });

    it("IN_PROGRESS 티켓을 완료하면 DONE이 되고 completedAt이 설정된다", async () => {
      const row = await insertTicket({ status: TICKET_STATUS.IN_PROGRESS });

      const ticket = await completeTicket(row.id);

      expect(ticket?.status).toBe(TICKET_STATUS.DONE);
      expect(ticket?.completedAt).not.toBeNull();
    });

    it("BACKLOG 티켓을 완료하면 DONE이 되고 startedAt은 null로 유지된다", async () => {
      const row = await insertTicket({
        status: TICKET_STATUS.BACKLOG,
        startedAt: null,
      });

      const ticket = await completeTicket(row.id);

      expect(ticket?.status).toBe(TICKET_STATUS.DONE);
      expect(ticket?.completedAt).not.toBeNull();
      expect(ticket?.startedAt).toBeNull();
    });

    it("완료해도 제목·설명·우선순위·일정·startedAt·createdAt은 변하지 않는다", async () => {
      const row = await insertTicket();

      const ticket = await completeTicket(row.id);

      expect(ticket).toMatchObject({
        id: row.id,
        title: "완료할 티켓",
        description: "원래 설명",
        priority: "HIGH",
        plannedStartDate: "2026-10-01",
        dueDate: "2099-12-31",
      });
      expect(ticket?.startedAt?.getTime()).toBe(row.startedAt!.getTime());
      expect(ticket?.createdAt.getTime()).toBe(row.createdAt.getTime());
    });

    // TC-API-005-07: 이미 DONE인 티켓은 값을 바꾸지 않고 그대로 반환한다 (멱등)
    it("이미 DONE인 티켓을 다시 완료해도 completedAt·position·updatedAt이 바뀌지 않는다", async () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const row = await insertTicket({
        status: TICKET_STATUS.DONE,
        position: 500,
        completedAt: past,
        updatedAt: past,
      });

      const ticket = await completeTicket(row.id);
      const stored = await getTicketById(row.id);

      expect(ticket?.status).toBe(TICKET_STATUS.DONE);
      expect(ticket?.completedAt?.getTime()).toBe(past.getTime());
      expect(ticket?.updatedAt.getTime()).toBe(past.getTime());
      expect(ticket?.position).toBe(500);
      expect(stored?.completedAt?.getTime()).toBe(past.getTime());
      expect(stored?.updatedAt.getTime()).toBe(past.getTime());
      expect(stored?.position).toBe(500);
    });

    it("같은 티켓을 동시에 두 번 완료해도 completedAt·position이 덮어써지지 않는다", async () => {
      const row = await insertTicket();

      const [first, second] = await Promise.all([
        completeTicket(row.id),
        completeTicket(row.id),
      ]);
      const stored = await getTicketById(row.id);

      expect(first?.completedAt?.getTime()).toBe(second?.completedAt?.getTime());
      expect(first?.position).toBe(second?.position);
      expect(stored?.completedAt?.getTime()).toBe(first?.completedAt?.getTime());
      expect(stored?.position).toBe(first?.position);
    });

    // TC-API-005-03: DONE 칼럼이 비어 있으면 1024
    it("DONE 칼럼에 티켓이 없으면 완료된 티켓의 position은 1024다", async () => {
      const row = await insertTicket();

      const ticket = await completeTicket(row.id);

      expect(ticket?.position).toBe(1024);
    });

    // TC-API-005-04: 기존 최솟값 - 1024
    it("DONE 칼럼 최솟값이 1024이면 완료된 티켓의 position은 0으로 맨 위에 배치된다", async () => {
      await insertTicket({
        title: "이미 완료",
        status: TICKET_STATUS.DONE,
        position: 1024,
        completedAt: new Date(),
      });
      const row = await insertTicket();

      const ticket = await completeTicket(row.id);

      expect(ticket?.position).toBe(0);
      expect(ticket!.position).toBeLessThan(1024);
    });

    it("티켓을 연달아 완료하면 나중에 완료한 티켓의 position이 더 작다", async () => {
      const first = await insertTicket({ title: "먼저" });
      const second = await insertTicket({ title: "나중" });

      const firstDone = await completeTicket(first.id);
      const secondDone = await completeTicket(second.id);

      expect(firstDone?.position).toBe(1024);
      expect(secondDone?.position).toBe(0);
    });

    it("24시간이 지나 보드에서 숨겨진 DONE 행도 최솟값 계산에 포함된다", async () => {
      await insertTicket({
        title: "오래된 완료",
        status: TICKET_STATUS.DONE,
        position: 500,
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
      const row = await insertTicket();

      const ticket = await completeTicket(row.id);

      expect(ticket?.position).toBe(-524);
    });

    // TC-API-008-09: 완료 상태가 우선 적용되어 isOverdue=false
    it("종료예정일이 지난 미완료 티켓을 완료하면 isOverdue가 false다", async () => {
      const row = await insertTicket({ dueDate: new Date("2020-01-01") });
      expect((await getTicketById(row.id))?.isOverdue).toBe(true);

      const ticket = await completeTicket(row.id);

      expect(ticket?.dueDate).toBe("2020-01-01");
      expect(ticket?.isOverdue).toBe(false);
    });

    it("존재하지 않는 id면 null을 반환하고 다른 티켓은 변경되지 않는다", async () => {
      const row = await insertTicket();

      const ticket = await completeTicket(999999);
      const stored = await getTicketById(row.id);

      expect(ticket).toBeNull();
      expect(stored?.status).toBe(TICKET_STATUS.TODO);
      expect(stored?.completedAt).toBeNull();
      expect(stored?.position).toBe(2048);
    });
  });
});

afterAll(async () => {
  await db.$client.end();
});
