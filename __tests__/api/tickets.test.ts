/** @jest-environment node */
import { POST } from "@/app/api/tickets/route";
import { db } from "@/server/db/client";
import { tickets } from "@/server/db/schema";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
