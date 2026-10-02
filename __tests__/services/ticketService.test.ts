/** @jest-environment node */
import {
  calculateIsOverdue,
  completeTicket,
  deleteTicket,
  getBoardData,
  getNextBacklogPosition,
  getTicketById,
  reorderTicket,
  updateTicket,
} from "@/server/services/ticketService";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets } from "@/server/db/schema";
import { TICKET_STATUS, type ReorderableStatus } from "@/shared/types";

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
  describe("deleteTicket", () => {
    async function insertTicket(overrides: Partial<typeof tickets.$inferInsert> = {}) {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "삭제할 티켓",
          description: "원래 설명",
          status: TICKET_STATUS.TODO,
          priority: "HIGH",
          position: 2048,
          ...overrides,
        })
        .returning();
      return row;
    }

    it("존재하는 티켓을 삭제하면 true를 반환하고 이후 조회하면 null이다", async () => {
      const row = await insertTicket();

      const deleted = await deleteTicket(row.id);
      const stored = await getTicketById(row.id);

      expect(deleted).toBe(true);
      expect(stored).toBeNull();
    });

    it.each([
      [TICKET_STATUS.BACKLOG],
      [TICKET_STATUS.TODO],
      [TICKET_STATUS.IN_PROGRESS],
      [TICKET_STATUS.DONE],
    ])("%s 상태의 티켓도 삭제할 수 있다", async (status) => {
      const row = await insertTicket({
        status,
        completedAt:
          status === TICKET_STATUS.DONE
            ? new Date(Date.now() - 25 * 60 * 60 * 1000)
            : null,
      });

      const deleted = await deleteTicket(row.id);

      expect(deleted).toBe(true);
      expect(await getTicketById(row.id)).toBeNull();
    });

    it("삭제 직후 DB를 직접 조회하면 행이 남아 있지 않다 (Hard Delete)", async () => {
      const row = await insertTicket();

      await deleteTicket(row.id);
      const rows = await db.select().from(tickets).where(eq(tickets.id, row.id));

      expect(rows).toHaveLength(0);
    });

    it("가운데 티켓을 삭제해도 나머지 티켓의 내용과 position은 재정렬 없이 그대로다", async () => {
      const past = new Date(Date.now() - 60 * 1000);
      const first = await insertTicket({ title: "첫째", position: 1024, updatedAt: past });
      const middle = await insertTicket({ title: "가운데", position: 2048 });
      const last = await insertTicket({ title: "셋째", position: 3072, updatedAt: past });

      await deleteTicket(middle.id);

      const storedFirst = await getTicketById(first.id);
      const storedLast = await getTicketById(last.id);
      expect(storedFirst).toMatchObject({ title: "첫째", description: "원래 설명", position: 1024 });
      expect(storedFirst?.updatedAt.getTime()).toBe(past.getTime());
      expect(storedLast).toMatchObject({ title: "셋째", description: "원래 설명", position: 3072 });
      expect(storedLast?.updatedAt.getTime()).toBe(past.getTime());
    });

    it("다른 칼럼의 티켓은 영향받지 않는다", async () => {
      const target = await insertTicket({ status: TICKET_STATUS.TODO });
      const other = await insertTicket({
        status: TICKET_STATUS.IN_PROGRESS,
        position: 1024,
      });

      await deleteTicket(target.id);

      const stored = await getTicketById(other.id);
      expect(stored).toMatchObject({ status: TICKET_STATUS.IN_PROGRESS, position: 1024 });
    });

    it("존재하지 않는 id면 false를 반환하고 다른 티켓은 삭제되지 않는다", async () => {
      const row = await insertTicket();

      const deleted = await deleteTicket(999999);

      expect(deleted).toBe(false);
      expect(await getTicketById(row.id)).not.toBeNull();
    });

    it("같은 id를 연달아 삭제하면 첫 번째만 true다", async () => {
      const row = await insertTicket();

      const first = await deleteTicket(row.id);
      const second = await deleteTicket(row.id);

      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it("같은 id를 동시에 삭제하면 한쪽만 true다", async () => {
      const row = await insertTicket();

      const results = await Promise.all([
        deleteTicket(row.id),
        deleteTicket(row.id),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("reorderTicket", () => {
    async function insertTicket(overrides: Partial<typeof tickets.$inferInsert> = {}) {
      const [row] = await db
        .insert(tickets)
        .values({
          title: "이동할 티켓",
          description: "원래 설명",
          status: TICKET_STATUS.TODO,
          priority: "HIGH",
          position: 2048,
          ...overrides,
        })
        .returning();
      return row;
    }

    async function getRow(id: number) {
      const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
      return row;
    }

    async function reorder(ticketId: number, status: ReorderableStatus, position: number) {
      const board = await reorderTicket({ ticketId, status, position });
      if (board === null) {
        throw new Error("이동할 티켓을 찾지 못했다");
      }
      return board;
    }

    // TC-API-007-01: 같은 칼럼 내에서 두 카드 사이로 순서 변경
    it("같은 칼럼의 두 티켓 사이 값으로 이동하면 요청한 position이 그대로 저장되고 칼럼은 오름차순이다", async () => {
      const prev = await insertTicket({ title: "앞", position: 1024 });
      const next = await insertTicket({ title: "뒤", position: 2048 });
      const moved = await insertTicket({ title: "이동", position: 4096 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 1536);

      expect((await getRow(moved.id)).position).toBe(1536);
      expect(board.TODO.map((ticket) => ticket.id)).toEqual([prev.id, moved.id, next.id]);
      expect(board.TODO.map((ticket) => ticket.position)).toEqual([1024, 1536, 2048]);
    });

    // TC-API-007-02: 칼럼 맨 앞으로 이동
    it("칼럼 맨 앞 값(첫 티켓 - 1024)으로 이동하면 첫 번째가 된다", async () => {
      const first = await insertTicket({ position: 1024 });
      const moved = await insertTicket({ position: 2048 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 0);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([moved.id, first.id]);
      expect((await getRow(moved.id)).position).toBe(0);
    });

    // TC-API-007-03: 칼럼 맨 뒤로 이동
    it("칼럼 맨 뒤 값(마지막 티켓 + 1024)으로 이동하면 마지막이 된다", async () => {
      const moved = await insertTicket({ position: 1024 });
      const last = await insertTicket({ position: 2048 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 3072);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([last.id, moved.id]);
      expect((await getRow(moved.id)).position).toBe(3072);
    });

    it("다른 칼럼으로 이동하면 status가 바뀌고 원래 칼럼에서 사라지며 4개 칼럼 보드를 반환한다", async () => {
      const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 1024 });

      const board = await reorder(moved.id, TICKET_STATUS.IN_PROGRESS, 1024);

      expect((await getRow(moved.id)).status).toBe(TICKET_STATUS.IN_PROGRESS);
      expect(Object.keys(board).sort()).toEqual(["BACKLOG", "DONE", "IN_PROGRESS", "TODO"]);
      expect(board.BACKLOG.map((ticket) => ticket.id)).not.toContain(moved.id);
      expect(board.IN_PROGRESS.map((ticket) => ticket.id)).toEqual([moved.id]);
    });

    // TC-API-007-20: 빈 칼럼으로 이동
    it("빈 칼럼으로 이동하면 유일한 항목이 되고 요청한 position이 그대로 저장된다", async () => {
      const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 4096 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 1024);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([moved.id]);
      expect((await getRow(moved.id)).position).toBe(1024);
    });

    // TC-API-007-19: 같은 칼럼의 같은 위치로 이동
    it("같은 칼럼의 같은 position으로 이동해도 충돌이 아니며 배치가 그대로다", async () => {
      const first = await insertTicket({ position: 1024 });
      const second = await insertTicket({ position: 2048 });

      const board = await reorder(first.id, TICKET_STATUS.TODO, 1024);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([first.id, second.id]);
      expect(board.TODO.map((ticket) => ticket.position)).toEqual([1024, 2048]);
    });

    // TC-API-007-04: 요청값이 기존 티켓과 같으면 칼럼 전체를 1024 간격으로 재정렬하고 이동 티켓이 앞에 놓인다
    it("요청한 position이 대상 칼럼의 다른 티켓과 같으면 칼럼을 1024 간격으로 재정렬하고 이동 티켓을 앞에 놓는다", async () => {
      const a = await insertTicket({ position: 1024 });
      const b = await insertTicket({ position: 2048 });
      const c = await insertTicket({ position: 3072 });
      const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 1024 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 2048);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([a.id, moved.id, b.id, c.id]);
      expect(board.TODO.map((ticket) => ticket.position)).toEqual([1024, 2048, 3072, 4096]);
    });

    // TC-API-007-04: 정수 간격이 없을 때 클라이언트가 올림한 값(= next의 position)을 보내는 경우
    it("두 티켓의 position이 인접한 정수(1024, 1025)일 때 올림한 값 1025로 이동하면 두 티켓 사이에 놓인다", async () => {
      const a = await insertTicket({ position: 1024 });
      const b = await insertTicket({ position: 1025 });
      const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 1024 });

      const board = await reorder(moved.id, TICKET_STATUS.TODO, 1025);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([a.id, moved.id, b.id]);
      expect(board.TODO.map((ticket) => ticket.position)).toEqual([1024, 2048, 3072]);
    });

    // TC-API-007-26: 충돌 재정렬은 대상 칼럼만 바꾼다
    it("충돌 재정렬이 일어나도 다른 칼럼과 원래 칼럼의 나머지 티켓 position은 변하지 않는다", async () => {
      await insertTicket({ position: 1024 });
      await insertTicket({ position: 2048 });
      const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 1024 });
      const backlogOther = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 7 });
      const inProgress = await insertTicket({ status: TICKET_STATUS.IN_PROGRESS, position: 1024 });

      await reorder(moved.id, TICKET_STATUS.TODO, 2048);

      expect((await getRow(backlogOther.id)).position).toBe(7);
      expect((await getRow(inProgress.id)).position).toBe(1024);
      expect((await getRow(inProgress.id)).status).toBe(TICKET_STATUS.IN_PROGRESS);
    });

    // TC-API-007-21: 이동은 단계·순서·시각 외의 필드를 바꾸지 않는다
    it("이동해도 제목·설명·우선순위·예정일·종료예정일·createdAt은 그대로이고 updatedAt은 갱신된다", async () => {
      const original = await insertTicket({
        title: "그대로여야 함",
        description: "설명도 그대로",
        priority: "LOW",
        plannedStartDate: new Date("2026-10-01"),
        dueDate: new Date("2099-12-31"),
        updatedAt: new Date(Date.now() - 60 * 1000),
      });

      await reorder(original.id, TICKET_STATUS.IN_PROGRESS, 1024);
      const after = await getRow(original.id);

      expect(after.title).toBe(original.title);
      expect(after.description).toBe(original.description);
      expect(after.priority).toBe(original.priority);
      expect(after.plannedStartDate).toEqual(original.plannedStartDate);
      expect(after.dueDate).toEqual(original.dueDate);
      expect(after.createdAt).toEqual(original.createdAt);
      expect(after.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    });

    describe("시각 규칙 (startedAt / completedAt)", () => {
      const threeDaysAgo = () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // TC-API-007-05: BACKLOG → TODO (최초 시작)
      it("startedAt이 null인 BACKLOG 티켓을 TODO로 이동하면 startedAt이 현재 시각으로 설정된다", async () => {
        const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, startedAt: null });

        const before = new Date();
        await reorder(moved.id, TICKET_STATUS.TODO, 1024);
        const after = new Date();

        const startedAt = (await getRow(moved.id)).startedAt;
        expect(startedAt).not.toBeNull();
        expect(startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      // TC-API-007-06: TODO를 거치지 않고 IN_PROGRESS로 직접 이동
      it("startedAt이 null인 BACKLOG 티켓을 IN_PROGRESS로 직접 이동해도 startedAt이 현재 시각으로 설정된다", async () => {
        const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, startedAt: null });

        const before = new Date();
        await reorder(moved.id, TICKET_STATUS.IN_PROGRESS, 1024);
        const after = new Date();

        const startedAt = (await getRow(moved.id)).startedAt;
        expect(startedAt).not.toBeNull();
        expect(startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      // TC-API-007-07: 이미 설정된 startedAt은 덮어쓰지 않는다
      it("startedAt이 이미 있는 티켓을 TODO ↔ IN_PROGRESS로 옮겨도 startedAt이 그대로다", async () => {
        const startedAt = threeDaysAgo();
        const moved = await insertTicket({ status: TICKET_STATUS.TODO, startedAt });

        await reorder(moved.id, TICKET_STATUS.IN_PROGRESS, 1024);
        expect((await getRow(moved.id)).startedAt?.getTime()).toBe(startedAt.getTime());

        await reorder(moved.id, TICKET_STATUS.TODO, 1024);
        expect((await getRow(moved.id)).startedAt?.getTime()).toBe(startedAt.getTime());
      });

      // TC-API-007-08: TODO → BACKLOG
      it("TODO 티켓을 BACKLOG로 되돌리면 startedAt이 null이 된다", async () => {
        const moved = await insertTicket({ status: TICKET_STATUS.TODO, startedAt: threeDaysAgo() });

        await reorder(moved.id, TICKET_STATUS.BACKLOG, 1024);

        expect((await getRow(moved.id)).startedAt).toBeNull();
      });

      // TC-API-007-25: IN_PROGRESS·DONE → BACKLOG
      it("IN_PROGRESS 티켓을 BACKLOG로 되돌리면 startedAt이 null이 된다", async () => {
        const moved = await insertTicket({
          status: TICKET_STATUS.IN_PROGRESS,
          startedAt: threeDaysAgo(),
        });

        await reorder(moved.id, TICKET_STATUS.BACKLOG, 1024);

        expect((await getRow(moved.id)).startedAt).toBeNull();
      });

      // TC-API-007-25: DONE → BACKLOG는 startedAt과 completedAt을 모두 비운다
      it("DONE 티켓을 BACKLOG로 되돌리면 startedAt과 completedAt이 모두 null이 된다", async () => {
        const moved = await insertTicket({
          status: TICKET_STATUS.DONE,
          startedAt: threeDaysAgo(),
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        });

        await reorder(moved.id, TICKET_STATUS.BACKLOG, 1024);
        const after = await getRow(moved.id);

        expect(after.startedAt).toBeNull();
        expect(after.completedAt).toBeNull();
      });

      // TC-API-007-09: DONE → 다른 칼럼
      it.each([
        [TICKET_STATUS.BACKLOG],
        [TICKET_STATUS.TODO],
        [TICKET_STATUS.IN_PROGRESS],
      ] as const)("DONE 티켓을 %s로 이동하면 completedAt이 null이 된다", async (target) => {
        const moved = await insertTicket({
          status: TICKET_STATUS.DONE,
          startedAt: threeDaysAgo(),
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        });

        await reorder(moved.id, target, 1024);

        expect((await getRow(moved.id)).completedAt).toBeNull();
      });

      it("startedAt이 있는 DONE 티켓을 TODO로 이동하면 startedAt은 유지된다", async () => {
        const startedAt = threeDaysAgo();
        const moved = await insertTicket({
          status: TICKET_STATUS.DONE,
          startedAt,
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        });

        await reorder(moved.id, TICKET_STATUS.TODO, 1024);

        expect((await getRow(moved.id)).startedAt?.getTime()).toBe(startedAt.getTime());
      });

      // TC-API-007-10: DONE이 아닌 칼럼 간 이동은 completedAt을 건드리지 않는다
      it("BACKLOG → TODO → IN_PROGRESS로 이동하는 동안 completedAt은 계속 null이다", async () => {
        const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, startedAt: null });

        await reorder(moved.id, TICKET_STATUS.TODO, 1024);
        expect((await getRow(moved.id)).completedAt).toBeNull();

        await reorder(moved.id, TICKET_STATUS.IN_PROGRESS, 1024);
        expect((await getRow(moved.id)).completedAt).toBeNull();
      });

      // TC-API-007-24: 24시간이 지나 보드에서 숨겨진 DONE 티켓도 이동할 수 있다
      it("completedAt이 25시간 전이라 보드에서 숨겨진 DONE 티켓을 TODO로 이동하면 completedAt이 null이 되고 보드 TODO에 나타난다", async () => {
        const moved = await insertTicket({
          status: TICKET_STATUS.DONE,
          completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        });
        expect((await getBoardData()).DONE.map((ticket) => ticket.id)).not.toContain(moved.id);

        const board = await reorder(moved.id, TICKET_STATUS.TODO, 1024);

        expect((await getRow(moved.id)).completedAt).toBeNull();
        expect(board.TODO.map((ticket) => ticket.id)).toContain(moved.id);
      });

      it("BACKLOG 안에서 순서만 바꾸면 startedAt은 null로 유지된다", async () => {
        await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 1024 });
        const moved = await insertTicket({ status: TICKET_STATUS.BACKLOG, position: 2048 });

        await reorder(moved.id, TICKET_STATUS.BACKLOG, 0);

        expect((await getRow(moved.id)).startedAt).toBeNull();
      });

      it("충돌 재정렬 경로로 이동해도 시각 규칙이 똑같이 적용된다", async () => {
        await insertTicket({ status: TICKET_STATUS.TODO, position: 1024 });
        const moved = await insertTicket({
          status: TICKET_STATUS.DONE,
          position: 5000,
          completedAt: new Date(Date.now() - 60 * 60 * 1000),
        });

        await reorder(moved.id, TICKET_STATUS.TODO, 1024);
        const after = await getRow(moved.id);

        expect(after.completedAt).toBeNull();
        expect(after.startedAt).not.toBeNull();
      });
    });

    // TC-API-007-13: 존재하지 않는 ticketId
    it("존재하지 않는 ticketId면 null을 반환하고 다른 티켓은 변경되지 않는다", async () => {
      const other = await insertTicket({ position: 1024 });

      const board = await reorderTicket({
        ticketId: 999999,
        status: TICKET_STATUS.TODO,
        position: 1024,
      });
      const stored = await getRow(other.id);

      expect(board).toBeNull();
      expect(stored.status).toBe(TICKET_STATUS.TODO);
      expect(stored.position).toBe(1024);
    });

    // TC-API-007-14: 재정렬 도중 실패하면 전체가 롤백된다 (원자성)
    it("충돌 재정렬 중 두 번째 UPDATE가 실패하면 예외가 전파되고 이동 티켓을 포함한 모든 변경이 롤백된다", async () => {
      const a = await insertTicket({ position: 1024 });
      const b = await insertTicket({ position: 2048 });
      const moved = await insertTicket({
        status: TICKET_STATUS.BACKLOG,
        position: 5000,
        startedAt: null,
      });
      const snapshot = async () =>
        Promise.all([a, b, moved].map(async (ticket) => getRow(ticket.id)));
      const before = await snapshot();

      const originalTransaction = db.transaction.bind(db);
      const spy = jest.spyOn(db, "transaction").mockImplementation(((
        callback: Parameters<typeof originalTransaction>[0]
      ) =>
        originalTransaction(async (tx) => {
          const originalUpdate = tx.update.bind(tx);
          let updateCount = 0;
          tx.update = ((...args: Parameters<typeof originalUpdate>) => {
            updateCount += 1;
            if (updateCount === 2) {
              throw new Error("DB 오류 주입");
            }
            return originalUpdate(...args);
          }) as typeof tx.update;
          return callback(tx);
        })) as typeof db.transaction);

      try {
        // 대상 칼럼 [a=1024, b=2048]에 2048로 끼워 넣으면 moved → b 순서로 UPDATE가 두 번 필요하다
        await expect(reorder(moved.id, TICKET_STATUS.TODO, 2048)).rejects.toThrow("DB 오류 주입");
      } finally {
        spy.mockRestore();
      }

      expect(await snapshot()).toEqual(before);
    });
  });
});

afterAll(async () => {
  await db.$client.end();
});
