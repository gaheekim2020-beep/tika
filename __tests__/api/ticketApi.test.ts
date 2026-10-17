import {
  ApiError,
  completeTicket,
  createTicket,
  deleteTicket,
  fetchBoard,
  fetchTicket,
  reorderTicket,
  updateTicket,
} from "@/client/api/ticketApi";
import { readError } from "@/client/lib/readError";
import { COLUMN_ORDER } from "@/shared/types";
import { emptyResponse, htmlResponse, jsonResponse, mockFetch, networkError, restoreFetch } from "../helpers/fetchMock";
import { makeBoard, makeTicket } from "../helpers/fixtures";

// 서버 응답(JSON)에서는 Date가 ISO 문자열이 된다. fixture를 JSON으로 한 번 거쳐 "서버가 보낸 모양"을 만든다.
const toWire = <T,>(value: T): unknown => JSON.parse(JSON.stringify(value));

const wireTicket = (overrides = {}) =>
  toWire(
    makeTicket({
      id: 7,
      title: "새 업무",
      startedAt: new Date("2026-10-01T09:00:00.000Z"),
      completedAt: null,
      dueDate: "2026-10-20",
      plannedStartDate: "2026-10-10",
      ...overrides,
    })
  );

const wireBoard = () => toWire(makeBoard());

const errorBody = (code: string, message: string, field?: string) => ({
  error: { code, message, ...(field ? { field } : {}) },
});

afterEach(restoreFetch);

describe("ticketApi — 요청 (TC-CLIENT-API-001-01~07)", () => {
  // TC-CLIENT-API-001-01
  it("fetchBoard는 GET /api/tickets로 요청하고 4개 칼럼 보드를 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireBoard()));

    const board = await fetchBoard();

    expect(fetchMock).toHaveBeenCalledWith("/api/tickets", expect.objectContaining({ method: "GET" }));
    expect(Object.keys(board)).toEqual(COLUMN_ORDER);
    expect(board.BACKLOG.length).toBeGreaterThan(0);
  });

  // TC-CLIENT-API-001-02
  it("fetchTicket(7)은 GET /api/tickets/7로 요청하고 티켓 한 건을 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireTicket()));

    const ticket = await fetchTicket(7);

    expect(fetchMock).toHaveBeenCalledWith("/api/tickets/7", expect.objectContaining({ method: "GET" }));
    expect(ticket).toMatchObject({ id: 7, title: "새 업무" });
  });

  // TC-CLIENT-API-001-03
  it("createTicket은 POST /api/tickets로 JSON 본문을 보내고 생성된 티켓을 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(201, wireTicket()));

    const ticket = await createTicket({ title: "새 업무" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tickets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: '{"title":"새 업무"}',
      })
    );
    expect(ticket.id).toBe(7);
  });

  // TC-CLIENT-API-001-04
  it("updateTicket은 PATCH /api/tickets/7로 전달한 필드만 보내고 수정된 티켓을 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireTicket({ title: "수정" })));

    const ticket = await updateTicket(7, { title: "수정" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tickets/7",
      expect.objectContaining({ method: "PATCH", body: '{"title":"수정"}' })
    );
    expect(ticket.title).toBe("수정");
  });

  it("updateTicket은 null(값 지우기)도 그대로 전달한다 (API_SPEC §4)", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireTicket({ description: null, dueDate: null })));

    await updateTicket(7, { description: null, dueDate: null });

    expect(fetchMock.mock.calls[0][1].body).toBe('{"description":null,"dueDate":null}');
  });

  // TC-CLIENT-API-001-05
  it("deleteTicket은 DELETE /api/tickets/7로 요청하고 204(본문 없음)에도 오류 없이 완료된다", async () => {
    const fetchMock = mockFetch(emptyResponse(204));

    await expect(deleteTicket(7)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/tickets/7", expect.objectContaining({ method: "DELETE" }));
  });

  // TC-CLIENT-API-001-06
  it("completeTicket은 PATCH /api/tickets/7/complete로 본문 없이 요청하고 갱신된 티켓을 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireTicket({ status: "DONE" })));

    const ticket = await completeTicket(7);

    expect(fetchMock).toHaveBeenCalledWith("/api/tickets/7/complete", expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(ticket.status).toBe("DONE");
  });

  // TC-CLIENT-API-001-07
  it("reorderTicket은 PATCH /api/tickets/reorder로 요청하고 4개 칼럼 보드를 반환한다", async () => {
    const fetchMock = mockFetch(jsonResponse(200, wireBoard()));

    const board = await reorderTicket({ ticketId: 7, status: "TODO", position: 1536 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tickets/reorder",
      expect.objectContaining({ method: "PATCH", body: '{"ticketId":7,"status":"TODO","position":1536}' })
    );
    expect(Object.keys(board)).toEqual(COLUMN_ORDER);
  });
});

describe("ticketApi — 날짜 변환 (TC-CLIENT-API-001-08)", () => {
  const expectDates = (ticket: ReturnType<typeof makeTicket>) => {
    expect(ticket.createdAt).toBeInstanceOf(Date);
    expect(ticket.updatedAt).toBeInstanceOf(Date);
    expect(ticket.startedAt).toEqual(new Date("2026-10-01T09:00:00.000Z"));
    expect(ticket.completedAt).toBeNull();
    // 날짜(YYYY-MM-DD)만 있는 필드는 문자열 그대로 둔다
    expect(ticket.plannedStartDate).toBe("2026-10-10");
    expect(ticket.dueDate).toBe("2026-10-20");
  };

  it.each([
    ["fetchTicket", () => fetchTicket(7), 200],
    ["createTicket", () => createTicket({ title: "새 업무" }), 201],
    ["updateTicket", () => updateTicket(7, { title: "새 업무" }), 200],
    ["completeTicket", () => completeTicket(7), 200],
  ])("%s의 응답에서 시각 필드 4개를 Date로 바꾼다", async (_name, call, status) => {
    mockFetch(jsonResponse(status, wireTicket()));

    expectDates(await call());
  });

  it("보드 응답의 모든 칼럼 카드에도 Date 변환을 적용한다", async () => {
    mockFetch(jsonResponse(200, wireBoard()));

    const board = await fetchBoard();

    COLUMN_ORDER.flatMap((status) => board[status]).forEach((ticket) => {
      expect(ticket.createdAt).toBeInstanceOf(Date);
      expect(ticket.updatedAt).toBeInstanceOf(Date);
    });
    expect(board.TODO[0].startedAt).toBeInstanceOf(Date);
    expect(board.BACKLOG[0].startedAt).toBeNull();
  });

  it("reorderTicket 응답 보드에도 Date 변환을 적용한다", async () => {
    mockFetch(jsonResponse(200, wireBoard()));

    const board = await reorderTicket({ ticketId: 1, status: "TODO", position: 1024 });

    expect(board.DONE[0].completedAt).toBeInstanceOf(Date);
  });
});

describe("ticketApi — 오류 (TC-CLIENT-API-001-09~14)", () => {
  // TC-CLIENT-API-001-09
  it("필드가 있는 400은 ApiError로 reject되고 status·code·field·message가 담긴다", async () => {
    mockFetch(jsonResponse(400, errorBody("VALIDATION_ERROR", "제목을 입력해주세요", "title")));

    const error = await createTicket({ title: "" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      field: "title",
      message: "제목을 입력해주세요",
    });
  });

  // TC-CLIENT-API-001-10
  it("field가 없는 400은 ApiError의 field가 undefined다", async () => {
    mockFetch(jsonResponse(400, errorBody("VALIDATION_ERROR", "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요")));

    const error = await reorderTicket({ ticketId: 1, status: "TODO", position: 1 }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).field).toBeUndefined();
  });

  // TC-CLIENT-API-001-11
  it("404는 ApiError(status 404, code TICKET_NOT_FOUND)로 reject된다", async () => {
    mockFetch(jsonResponse(404, errorBody("TICKET_NOT_FOUND", "존재하지 않는 티켓입니다")));

    await expect(fetchTicket(999)).rejects.toMatchObject({ status: 404, code: "TICKET_NOT_FOUND" });
  });

  // TC-CLIENT-API-001-12
  it("500은 ApiError(status 500, code INTERNAL_ERROR)로 reject되고 서버 메시지가 보존된다", async () => {
    mockFetch(jsonResponse(500, errorBody("INTERNAL_ERROR", "티켓 목록을 불러오지 못했습니다")));

    await expect(fetchBoard()).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "티켓 목록을 불러오지 못했습니다",
    });
  });

  // TC-CLIENT-API-001-13
  it.each([
    ["HTML 본문", () => htmlResponse(502, "<html>Bad Gateway</html>"), 502],
    ["빈 본문", () => emptyResponse(500), 500],
    ["error 모양이 아닌 JSON", () => jsonResponse(500, { message: "boom" }), 500],
  ])("JSON 오류 본문이 아닌 응답(%s)은 status를 보존하고 code=UNKNOWN_ERROR와 기본 메시지를 가진다", async (_label, response, status) => {
    mockFetch(response());

    const error = await fetchBoard().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code: "UNKNOWN_ERROR" });
    expect((error as ApiError).message).not.toBe("");
  });

  // TC-CLIENT-API-001-14
  it("fetch 자체가 reject(네트워크 오류)되어도 ApiError(code NETWORK_ERROR)로 통일한다", async () => {
    mockFetch(networkError());

    const error = await fetchBoard().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    expect((error as ApiError).message).not.toBe("");
  });

  it("네트워크 오류는 모든 API 함수에 똑같이 적용된다", async () => {
    mockFetch(networkError(), networkError(), networkError());

    await expect(deleteTicket(7)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(completeTicket(7)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(updateTicket(7, { title: "x" })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("ApiError는 Error이고 이름이 ApiError다", () => {
    const error = new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "메시지", field: "title" });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("메시지");
  });

  it("readError가 ApiError에서 message와 field를 그대로 읽는다 (모달의 필드 오류·토스트 분기)", async () => {
    mockFetch(jsonResponse(400, errorBody("VALIDATION_ERROR", "제목을 입력해주세요", "title")));
    const error = await createTicket({ title: "" }).catch((caught: unknown) => caught);

    expect(readError(error, "기본 메시지")).toEqual({ message: "제목을 입력해주세요", field: "title" });
  });
});
