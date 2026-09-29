/** @jest-environment node */
import { GET, POST } from "@/app/api/tickets/route";
import { GET as GET_BY_ID, PATCH } from "@/app/api/tickets/[id]/route";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets } from "@/server/db/schema";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/tickets/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/tickets", () => {
  afterEach(async () => {
    await db.delete(tickets);
  });

  afterAll(async () => {
    await db.delete(tickets);
  });

  // TC-API-001-01: 제목만으로 생성
  it("제목만 입력하면 201과 함께 BACKLOG/MEDIUM/isOverdue=false를 반환한다", async () => {
    const res = await POST(makeRequest({ title: "로그인 페이지 구현" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      title: "로그인 페이지 구현",
      description: null,
      status: "BACKLOG",
      priority: "MEDIUM",
      position: 1024,
      plannedStartDate: null,
      dueDate: null,
      startedAt: null,
      completedAt: null,
      isOverdue: false,
    });
    expect(typeof body.id).toBe("number");
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  // TC-API-001-07: 제목 누락
  it("제목이 없으면 400 VALIDATION_ERROR(title)를 반환한다", async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목을 입력해주세요",
    });
  });

  // TC-API-001-08: 공백만 입력
  it("제목이 공백만 있으면 400 VALIDATION_ERROR(title)를 반환한다", async () => {
    const res = await POST(makeRequest({ title: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목을 입력해주세요",
    });
  });

  // TC-API-001-09: 제목 200자 초과
  it("제목이 200자를 초과하면 400 VALIDATION_ERROR(title)를 반환한다", async () => {
    const res = await POST(makeRequest({ title: "a".repeat(201) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목은 200자 이내로 입력해주세요",
    });
  });

  // TC-API-001-02: 모든 필드를 채워 생성
  it("모든 필드를 채워 생성하면 입력값이 그대로 반영된 201 응답을 반환한다", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await POST(
      makeRequest({
        title: "상세 티켓",
        description: "상세 설명입니다",
        priority: "HIGH",
        plannedStartDate: tomorrow,
        dueDate: tomorrow,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      title: "상세 티켓",
      description: "상세 설명입니다",
      status: "BACKLOG",
      priority: "HIGH",
      plannedStartDate: tomorrow,
      dueDate: tomorrow,
    });
  });

  // TC-API-001-05: description 미입력
  it("description을 생략하면 응답의 description은 null이다", async () => {
    const res = await POST(makeRequest({ title: "설명 생략 티켓" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.description).toBeNull();
  });

  // TC-API-001-06: priority 미입력
  it("priority를 생략하면 응답의 priority는 MEDIUM이다", async () => {
    const res = await POST(makeRequest({ title: "우선순위 생략 티켓" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.priority).toBe("MEDIUM");
  });

  // TC-API-001-10: 설명 1000자 초과
  it("description이 1000자를 초과하면 400 VALIDATION_ERROR(description)를 반환한다", async () => {
    const res = await POST(
      makeRequest({ title: "설명 초과 티켓", description: "a".repeat(1001) })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "description",
      message: "설명은 1000자 이내로 입력해주세요",
    });
  });

  // TC-API-001-11: 잘못된 우선순위 값
  it("priority가 허용값 외이면 400 VALIDATION_ERROR(priority)를 반환한다", async () => {
    const res = await POST(
      makeRequest({ title: "잘못된 우선순위 티켓", priority: "URGENT" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "priority",
      message: "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요",
    });
  });

  // TC-API-001-12: 과거 종료예정일
  it("dueDate가 과거 날짜이면 400 VALIDATION_ERROR(dueDate)를 반환한다", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await POST(
      makeRequest({ title: "과거 마감일 티켓", dueDate: yesterday })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "dueDate",
      message: "종료예정일은 오늘 이후 날짜를 선택해주세요",
    });
  });
});

// TC-API-001-13: DB 오류 등 예상치 못한 서버 오류
describe("POST /api/tickets - 서버 오류", () => {
  it("서비스 계층에서 예외가 발생하면 500 INTERNAL_ERROR를 반환한다", async () => {
    let mockedPOST!: typeof POST;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/server/services/ticketService", () => ({
        createTicket: jest.fn().mockRejectedValue(new Error("DB 연결 실패")),
      }));
      ({ POST: mockedPOST } = await import("@/app/api/tickets/route"));
    });

    const res = await mockedPOST(makeRequest({ title: "DB 오류 티켓" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "서버 오류가 발생했습니다",
    });
  });
});

describe("GET /api/tickets", () => {
  afterEach(async () => {
    await db.delete(tickets);
  });

  afterAll(async () => {
    await db.delete(tickets);
  });

  // TC-API-002-03: 티켓이 하나도 없는 상태에서 조회
  it("티켓이 하나도 없으면 200과 함께 4개 빈 배열 키를 반환한다", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    });
  });

  // TC-API-008-02/03/04: BACKLOG/TODO/IN_PROGRESS 오버듀 판정
  it.each([
    ["BACKLOG", "BACKLOG"],
    ["TODO", "TODO"],
    ["IN_PROGRESS", "IN_PROGRESS"],
  ])(
    "%s 상태에서 종료예정일이 지난 티켓은 isOverdue=true를 반환한다",
    async (_label, status) => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.insert(tickets).values({
        title: "지연된 티켓",
        status,
        position: 1024,
        dueDate: yesterday,
      });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body[status]).toHaveLength(1);
      expect(body[status][0].isOverdue).toBe(true);
    }
  );

  // TC-API-008-05: DONE 상태는 dueDate가 과거여도 isOverdue=false
  it("DONE 상태에서 종료예정일이 지난 티켓은 isOverdue=false를 반환한다", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.insert(tickets).values({
      title: "완료된 지연 티켓",
      status: "DONE",
      position: 1024,
      dueDate: yesterday,
      completedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.DONE).toHaveLength(1);
    expect(body.DONE[0].isOverdue).toBe(false);
  });
});

// TC-API-002-06: DB 오류 등 예상치 못한 서버 오류
describe("GET /api/tickets - 서버 오류", () => {
  it("서비스 계층에서 예외가 발생하면 500 INTERNAL_ERROR를 반환한다", async () => {
    let mockedGET!: typeof GET;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/server/services/ticketService", () => ({
        getBoardData: jest.fn().mockRejectedValue(new Error("DB 연결 실패")),
      }));
      ({ GET: mockedGET } = await import("@/app/api/tickets/route"));
    });

    const res = await mockedGET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "티켓 목록을 불러오지 못했습니다",
    });
  });
});

describe("GET /api/tickets/:id", () => {
  afterEach(async () => {
    await db.delete(tickets);
  });

  afterAll(async () => {
    await db.delete(tickets);
  });

  // TC-API-003-01: 존재하는 티켓 ID 조회
  it("존재하는 id로 조회하면 200과 함께 전체 필드를 반환한다", async () => {
    const [row] = await db
      .insert(tickets)
      .values({ title: "상세 조회 티켓", status: "BACKLOG", position: 1024 })
      .returning();

    const res = await GET_BY_ID(
      new Request("http://localhost"),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: row.id,
      title: "상세 조회 티켓",
      status: "BACKLOG",
      isOverdue: false,
    });
  });

  // TC-API-003-02: 완료된 지 24시간이 지난 DONE 티켓도 상세 조회는 성공해야 한다
  it("completedAt이 24시간을 초과한 DONE 티켓도 200으로 조회된다", async () => {
    const [row] = await db
      .insert(tickets)
      .values({
        title: "오래된 완료 티켓",
        status: "DONE",
        position: 1024,
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      })
      .returning();

    const res = await GET_BY_ID(
      new Request("http://localhost"),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("오래된 완료 티켓");
  });

  // TC-API-003-03/04: 잘못된 ID 형식
  it.each(["abc", "-1", "0"])(
    "id=%s이면 400 INVALID_ID를 반환한다",
    async (id) => {
      const res = await GET_BY_ID(new Request("http://localhost"), makeParams(id));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "INVALID_ID",
        message: "유효하지 않은 티켓 ID입니다",
      });
    }
  );

  // TC-API-003-05/06: 존재하지 않거나 삭제된 티켓
  it("존재하지 않는 id로 조회하면 404 TICKET_NOT_FOUND를 반환한다", async () => {
    const res = await GET_BY_ID(new Request("http://localhost"), makeParams("999999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "TICKET_NOT_FOUND",
      message: "존재하지 않거나 삭제된 티켓입니다",
    });
  });
});

describe("PATCH /api/tickets/:id", () => {
  afterEach(async () => {
    await db.delete(tickets);
  });

  afterAll(async () => {
    await db.delete(tickets);
  });

  async function insertFullTicket() {
    const [row] = await db
      .insert(tickets)
      .values({
        title: "원래 제목",
        description: "원래 설명",
        status: "TODO",
        priority: "HIGH",
        position: 2048,
        plannedStartDate: new Date("2026-10-01"),
        dueDate: new Date("2099-12-31"),
        updatedAt: new Date(Date.now() - 60 * 1000),
      })
      .returning();
    return row;
  }

  // TC-API-004-01: 제목만 수정
  it("제목만 수정하면 200과 함께 제목만 바뀌고 updatedAt이 갱신된다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ title: "수정된 제목" }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: row.id,
      title: "수정된 제목",
      description: "원래 설명",
      priority: "HIGH",
      plannedStartDate: "2026-10-01",
      dueDate: "2099-12-31",
    });
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });

  // TC-API-004-02: 여러 필드 동시 수정
  it("여러 필드를 동시에 수정하면 전달한 필드가 모두 반영된다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({
        title: "새 제목",
        description: "새 설명",
        priority: "LOW",
        plannedStartDate: "2026-11-01",
        dueDate: "2099-11-30",
      }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      title: "새 제목",
      description: "새 설명",
      priority: "LOW",
      plannedStartDate: "2026-11-01",
      dueDate: "2099-11-30",
    });
  });

  // TC-API-004-12: status/position은 처리 대상이 아니다
  it("body에 status/position이 있어도 무시되어 실제 상태와 순서는 바뀌지 않는다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ title: "수정된 제목", status: "DONE", position: 1 }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("수정된 제목");
    expect(body.status).toBe("TODO");
    expect(body.position).toBe(2048);
  });

  // TC-API-004-03: description을 null로 초기화
  it("description을 null로 전달하면 200과 함께 설명이 비워진다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(makePatchRequest({ description: null }), makeParams(String(row.id)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.description).toBeNull();
  });

  // TC-API-004-04: plannedStartDate를 null로 초기화
  it("plannedStartDate를 null로 전달하면 200과 함께 시작예정일이 비워진다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ plannedStartDate: null }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.plannedStartDate).toBeNull();
  });

  // TC-API-004-05: 빈 body
  it("빈 body면 200, 값은 유지되고 updatedAt만 갱신된다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(makePatchRequest({}), makeParams(String(row.id)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      title: "원래 제목",
      description: "원래 설명",
      priority: "HIGH",
      plannedStartDate: "2026-10-01",
      dueDate: "2099-12-31",
    });
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });

  // TC-API-004-15: dueDate를 null로 초기화 + isOverdue 재연산
  it("dueDate를 null로 전달하면 종료예정일이 비워지고 isOverdue가 false가 된다", async () => {
    const [row] = await db
      .insert(tickets)
      .values({
        title: "기한 지난 티켓",
        status: "TODO",
        position: 1024,
        dueDate: new Date("2020-01-01"),
      })
      .returning();

    const res = await PATCH(makePatchRequest({ dueDate: null }), makeParams(String(row.id)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dueDate).toBeNull();
    expect(body.isOverdue).toBe(false);
  });

  // TC-API-004-06: 공백만 있는 제목
  it("제목을 공백만으로 수정하면 400 VALIDATION_ERROR(field=title)를 반환한다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(makePatchRequest({ title: "   " }), makeParams(String(row.id)));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목을 입력해주세요",
    });
  });

  // TC-API-004-07: 제목 200자 초과
  it("제목이 201자면 400 VALIDATION_ERROR(field=title)를 반환한다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ title: "a".repeat(201) }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목은 200자 이내로 입력해주세요",
    });
  });

  // TC-API-004-08: 설명 1000자 초과
  it("설명이 1001자면 400 VALIDATION_ERROR(field=description)를 반환한다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ description: "a".repeat(1001) }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "description",
      message: "설명은 1000자 이내로 입력해주세요",
    });
  });

  // TC-API-004-09: 잘못된 우선순위
  it("잘못된 우선순위면 400 VALIDATION_ERROR(field=priority)를 반환한다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ priority: "URGENT" }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "priority",
      message: "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요",
    });
  });

  // TC-API-004-10: 과거 종료예정일
  it("종료예정일이 어제면 400 VALIDATION_ERROR(field=dueDate)를 반환한다", async () => {
    const row = await insertFullTicket();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDate = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, "0"),
      String(yesterday.getDate()).padStart(2, "0"),
    ].join("-");

    const res = await PATCH(makePatchRequest({ dueDate }), makeParams(String(row.id)));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      field: "dueDate",
      message: "종료예정일은 오늘 이후 날짜를 선택해주세요",
    });
  });

  // TC-API-004-16: 일부만 무효여도 전체 거절
  it("여러 필드 중 하나만 무효여도 400이고 유효한 필드도 반영되지 않는다", async () => {
    const row = await insertFullTicket();

    const res = await PATCH(
      makePatchRequest({ title: "정상 제목", priority: "URGENT" }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR", field: "priority" });

    const [unchanged] = await db.select().from(tickets).where(eq(tickets.id, row.id));
    expect(unchanged.title).toBe("원래 제목");
    expect(unchanged.priority).toBe("HIGH");
  });

  // TC-API-004-17: JSON이 아니거나 객체가 아닌 본문
  it.each([
    ["JSON이 아닌 문자열", "not json"],
    ["JSON 배열", "[]"],
  ])("본문이 %s이면 400 VALIDATION_ERROR(field 없음)를 반환한다", async (_label, raw) => {
    const row = await insertFullTicket();

    const res = await PATCH(
      new Request("http://localhost/api/tickets/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: raw,
      }),
      makeParams(String(row.id))
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("요청 본문이 올바른 JSON 형식이 아닙니다");
    expect(body.error).not.toHaveProperty("field");
  });

  // TC-API-004-13/14: 잘못된 ID 형식
  it.each(["abc", "-1", "0"])("id=%s이면 400 INVALID_ID를 반환한다", async (id) => {
    const res = await PATCH(makePatchRequest({ title: "수정" }), makeParams(id));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "INVALID_ID",
      message: "유효하지 않은 티켓 ID입니다",
    });
  });

  // TC-API-004-11: 존재하지 않는 티켓
  it("존재하지 않는 id로 수정하면 404 TICKET_NOT_FOUND를 반환한다", async () => {
    const res = await PATCH(makePatchRequest({ title: "수정" }), makeParams("999999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "TICKET_NOT_FOUND",
      message: "존재하지 않거나 삭제된 티켓입니다",
    });
  });
});

describe("GET /api/tickets/:id - 서버 오류", () => {
  it("서비스 계층에서 예외가 발생하면 500 INTERNAL_ERROR를 반환한다", async () => {
    let mockedGET!: typeof GET_BY_ID;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/server/services/ticketService", () => ({
        getTicketById: jest.fn().mockRejectedValue(new Error("DB 연결 실패")),
      }));
      ({ GET: mockedGET } = await import("@/app/api/tickets/[id]/route"));
    });

    const res = await mockedGET(new Request("http://localhost"), makeParams("1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "티켓을 불러오지 못했습니다",
    });
  });
});

describe("PATCH /api/tickets/:id - 서버 오류", () => {
  // TC-API-004-18
  it("서비스 계층에서 예외가 발생하면 500 INTERNAL_ERROR를 반환한다", async () => {
    let mockedPATCH!: typeof PATCH;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/server/services/ticketService", () => ({
        updateTicket: jest.fn().mockRejectedValue(new Error("DB 연결 실패")),
      }));
      ({ PATCH: mockedPATCH } = await import("@/app/api/tickets/[id]/route"));
    });

    const res = await mockedPATCH(makePatchRequest({ title: "수정" }), makeParams("1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "티켓을 수정하지 못했습니다",
    });
  });
});

afterAll(async () => {
  await db.$client.end();
});
