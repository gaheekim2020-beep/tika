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
});
