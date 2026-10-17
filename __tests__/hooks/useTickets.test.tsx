import { act, renderHook, waitFor } from "@testing-library/react";
import * as ticketApi from "@/client/api/ticketApi";
import { ApiError } from "@/client/api/ticketApi";
import { useTickets } from "@/client/hooks/useTickets";
import { COLUMN_ORDER, type BoardData, type TicketStatus } from "@/shared/types";
import { makeBoardOf, makeEmptyBoard, makeTicket } from "../helpers/fixtures";

// ApiError는 진짜 클래스를 쓰고, API 함수만 가짜로 바꾼다 (FRONTEND_TASKS §1.3)
jest.mock("@/client/api/ticketApi", () => ({
  ...jest.requireActual<typeof import("@/client/api/ticketApi")>("@/client/api/ticketApi"),
  fetchBoard: jest.fn(),
  fetchTicket: jest.fn(),
  createTicket: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  completeTicket: jest.fn(),
  reorderTicket: jest.fn(),
}));

const api = jest.mocked(ticketApi);

// 끝나는 시점을 테스트가 정하는 Promise — "서버 응답을 기다리는 중" 상태를 만들 때 쓴다
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const TICKET_A = makeTicket({ id: 1, title: "A", status: "BACKLOG", position: 1024 });
const TICKET_B = makeTicket({ id: 2, title: "B", status: "BACKLOG", position: 2048 });
const TICKET_C = makeTicket({ id: 3, title: "C", status: "TODO", position: 1024 });

// BACKLOG [A, B], TODO [C]
const makeInitial = () => makeBoardOf([TICKET_A, TICKET_B, TICKET_C]);

const ids = (board: BoardData, status: TicketStatus) => board[status].map((ticket) => ticket.id);

const apiError = (status: number, code: string, message: string, field?: string) =>
  new ApiError({ status, code, message, field });

beforeEach(() => {
  jest.resetAllMocks();
});

describe("useTickets — 불러오기", () => {
  // TC-HOOK-001-01
  it("initialData가 없으면 isLoading=true로 시작하고, 조회가 끝나면 board가 채워진다", async () => {
    const pending = deferred<BoardData>();
    api.fetchBoard.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useTickets());

    expect(result.current.isLoading).toBe(true);
    expect(COLUMN_ORDER.map((status) => result.current.board[status])).toEqual([[], [], [], []]);

    const loaded = makeInitial();
    await act(async () => pending.resolve(loaded));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.board).toEqual(loaded);
    expect(result.current.error).toBeNull();
    expect(api.fetchBoard).toHaveBeenCalledTimes(1);
  });

  // TC-HOOK-001-02
  it("initialData를 주면 조회하지 않고 그 값이 board이며 isLoading=false다", () => {
    const initial = makeInitial();

    const { result } = renderHook(() => useTickets(initial));

    expect(api.fetchBoard).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.board).toBe(initial);
  });

  // TC-HOOK-001-11
  it("초기 조회가 실패하면 error에 메시지가 채워지고 isLoading=false이며 board는 비어 있다", async () => {
    api.fetchBoard.mockRejectedValue(apiError(500, "INTERNAL_ERROR", "티켓 목록을 불러오지 못했습니다"));

    const { result } = renderHook(() => useTickets());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("티켓 목록을 불러오지 못했습니다");
    expect(result.current.board).toEqual(makeEmptyBoard());
  });

  // TC-HOOK-001-03
  it("조회 실패 뒤 refetch가 성공하면 board가 채워지고 이전 error가 지워진다", async () => {
    api.fetchBoard.mockRejectedValueOnce(apiError(500, "INTERNAL_ERROR", "실패"));
    const { result } = renderHook(() => useTickets());
    await waitFor(() => expect(result.current.error).toBe("실패"));

    const pending = deferred<BoardData>();
    api.fetchBoard.mockReturnValueOnce(pending.promise);
    act(() => {
      void result.current.refetch();
    });

    // 다시 불러오는 동안은 로딩 상태이고 이전 오류는 이미 지워진다
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    const loaded = makeInitial();
    await act(async () => pending.resolve(loaded));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.board).toEqual(loaded);
  });

  it("refetch가 여러 번 겹치면 가장 마지막 요청의 결과만 반영한다", async () => {
    const first = deferred<BoardData>();
    const second = deferred<BoardData>();
    api.fetchBoard.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTickets());

    act(() => {
      void result.current.refetch();
    });
    const newer = makeInitial();
    await act(async () => second.resolve(newer));
    await act(async () => first.resolve(makeEmptyBoard()));

    expect(result.current.board).toEqual(newer);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useTickets — 서버 응답을 받은 뒤 반영 (create / update / remove)", () => {
  // TC-HOOK-001-04
  it("create 성공 시 응답 티켓이 BACKLOG 맨 위에 추가된다", async () => {
    const created = makeTicket({ id: 99, title: "새 티켓", status: "BACKLOG", position: 0 });
    api.createTicket.mockResolvedValue(created);
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.create({ title: "새 티켓" });
    });

    expect(api.createTicket).toHaveBeenCalledWith({ title: "새 티켓" });
    expect(ids(result.current.board, "BACKLOG")).toEqual([99, 1, 2]);
  });

  // TC-HOOK-001-05
  it("update 성공 시 해당 카드가 서버가 돌려준 값으로 교체된다", async () => {
    const updated = { ...TICKET_B, title: "서버가 확정한 제목" };
    api.updateTicket.mockResolvedValue(updated);
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.update(2, { title: "수정" });
    });

    expect(api.updateTicket).toHaveBeenCalledWith(2, { title: "수정" });
    expect(result.current.board.BACKLOG.map((ticket) => ticket.title)).toEqual(["A", "서버가 확정한 제목"]);
  });

  // TC-HOOK-001-06
  it("remove 성공 시 보드에서 해당 카드가 사라진다", async () => {
    api.deleteTicket.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.remove(1);
    });

    expect(api.deleteTicket).toHaveBeenCalledWith(1);
    expect(ids(result.current.board, "BACKLOG")).toEqual([2]);
  });

  describe.each([
    ["create", () => api.createTicket, (hook: ReturnType<typeof useTickets>) => hook.create({ title: "x" })],
    ["update", () => api.updateTicket, (hook: ReturnType<typeof useTickets>) => hook.update(2, { title: "x" })],
    ["remove", () => api.deleteTicket, (hook: ReturnType<typeof useTickets>) => hook.remove(2)],
  ])("%s 실패", (_name, getApiMock, run) => {
    // TC-HOOK-001-12
    it("필드가 있는 400은 ApiError로 reject되고 error 상태는 채우지 않으며 보드는 그대로다", async () => {
      const failure = apiError(400, "VALIDATION_ERROR", "제목을 입력해주세요", "title");
      (getApiMock() as jest.Mock).mockRejectedValue(failure);
      const initial = makeInitial();
      const { result } = renderHook(() => useTickets(initial));

      let rejection: unknown;
      await act(async () => {
        rejection = await run(result.current).catch((caught: unknown) => caught);
      });

      expect(rejection).toBe(failure);
      expect(result.current.error).toBeNull();
      expect(result.current.board).toEqual(initial);
    });

    // TC-HOOK-001-13
    it.each([
      ["500", apiError(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다")],
      ["404", apiError(404, "TICKET_NOT_FOUND", "존재하지 않는 티켓입니다")],
      ["필드 없는 400", apiError(400, "VALIDATION_ERROR", "상태를 선택해주세요")],
      ["네트워크 오류", apiError(0, "NETWORK_ERROR", "서버에 연결하지 못했습니다")],
    ])("%s는 ApiError로 reject되고 error에 메시지가 채워지며 보드는 그대로다", async (_label, failure) => {
      (getApiMock() as jest.Mock).mockRejectedValue(failure);
      const initial = makeInitial();
      const { result } = renderHook(() => useTickets(initial));

      let rejection: unknown;
      await act(async () => {
        rejection = await run(result.current).catch((caught: unknown) => caught);
      });

      expect(rejection).toBe(failure);
      expect(result.current.error).toBe(failure.message);
      expect(result.current.board).toEqual(initial);
    });
  });
});

describe("useTickets — 먼저 화면에 반영하는 이동 (reorder / complete)", () => {
  // TC-HOOK-001-07
  it("reorder는 API 응답을 기다리지 않고 즉시 board를 바꾼다", async () => {
    const pending = deferred<BoardData>();
    api.reorderTicket.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useTickets(makeInitial()));

    let call!: Promise<void>;
    act(() => {
      call = result.current.reorder(1, "TODO", 1536);
    });

    // 서버 응답 전인데 이미 옮겨져 있다
    expect(api.reorderTicket).toHaveBeenCalledWith({ ticketId: 1, status: "TODO", position: 1536 });
    expect(ids(result.current.board, "BACKLOG")).toEqual([2]);
    expect(ids(result.current.board, "TODO")).toEqual([3, 1]);
    expect(result.current.board.TODO[1]).toMatchObject({ status: "TODO", position: 1536 });

    await act(async () => {
      pending.resolve(makeInitial());
      await call;
    });
  });

  // TC-HOOK-001-08
  it("reorder 응답을 받으면 board가 서버가 돌려준 보드로 교체된다", async () => {
    const serverBoard = makeBoardOf([
      { ...TICKET_A, status: "TODO", position: 1536 },
      { ...TICKET_B, title: "서버만 아는 값" },
      TICKET_C,
    ]);
    api.reorderTicket.mockResolvedValue(serverBoard);
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.reorder(1, "TODO", 1536);
    });

    expect(result.current.board).toEqual(serverBoard);
  });

  // TC-HOOK-001-09
  it("complete는 즉시 DONE 맨 위로 옮기고, 응답 후 서버 값(completedAt 포함)으로 확정한다", async () => {
    const pending = deferred<ReturnType<typeof makeTicket>>();
    api.completeTicket.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useTickets(makeInitial()));

    let call!: Promise<void>;
    act(() => {
      call = result.current.complete(3);
    });

    expect(api.completeTicket).toHaveBeenCalledWith(3);
    expect(ids(result.current.board, "TODO")).toEqual([]);
    expect(result.current.board.DONE[0]).toMatchObject({ id: 3, status: "DONE" });

    const serverTicket = {
      ...TICKET_C,
      status: "DONE" as const,
      position: 777,
      completedAt: new Date("2026-10-16T10:00:00.000Z"),
    };
    await act(async () => {
      pending.resolve(serverTicket);
      await call;
    });

    expect(result.current.board.DONE).toEqual([serverTicket]);
  });

  // TC-HOOK-001-14
  it("reorder가 실패하면 조용히 원래 상태로 되돌리고 error를 채우지 않으며 reject하지 않는다", async () => {
    api.reorderTicket.mockRejectedValue(apiError(500, "INTERNAL_ERROR", "서버 오류"));
    const initial = makeInitial();
    const { result } = renderHook(() => useTickets(initial));

    await act(async () => {
      await expect(result.current.reorder(1, "TODO", 1536)).resolves.toBeUndefined();
    });

    expect(result.current.board).toEqual(initial);
    expect(result.current.error).toBeNull();
  });

  // TC-HOOK-001-15
  it("complete가 실패하면 DONE으로 옮겼던 카드가 원래 칼럼·위치로 돌아간다", async () => {
    api.completeTicket.mockRejectedValue(apiError(404, "TICKET_NOT_FOUND", "없음"));
    const initial = makeInitial();
    const { result } = renderHook(() => useTickets(initial));

    await act(async () => {
      await expect(result.current.complete(3)).resolves.toBeUndefined();
    });

    expect(result.current.board).toEqual(initial);
    expect(result.current.error).toBeNull();
  });

  // TC-HOOK-001-16
  it("이동을 연달아 했을 때 B가 실패해도 먼저 성공한 A의 이동 결과는 유지된다", async () => {
    const boardAfterA = makeBoardOf([{ ...TICKET_A, status: "TODO", position: 1536 }, TICKET_B, TICKET_C]);
    api.reorderTicket
      .mockResolvedValueOnce(boardAfterA)
      .mockRejectedValueOnce(apiError(500, "INTERNAL_ERROR", "서버 오류"));
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.reorder(1, "TODO", 1536);
    });
    await act(async () => {
      await result.current.reorder(2, "TODO", 4096);
    });

    // B만 원래 자리(BACKLOG)로 돌아가고, A는 TODO에 그대로다
    expect(ids(result.current.board, "BACKLOG")).toEqual([2]);
    expect(ids(result.current.board, "TODO")).toEqual([3, 1]);
    expect(result.current.board).toEqual(boardAfterA);
  });

  it("응답이 오기 전에 두 번 옮겨도 늦게 실패한 쪽만 되돌리고 먼저 옮긴 쪽은 유지한다", async () => {
    const forA = deferred<BoardData>();
    const forB = deferred<BoardData>();
    api.reorderTicket.mockReturnValueOnce(forA.promise).mockReturnValueOnce(forB.promise);
    const { result } = renderHook(() => useTickets(makeInitial()));

    let callA!: Promise<void>;
    let callB!: Promise<void>;
    act(() => {
      callA = result.current.reorder(1, "TODO", 1536);
      callB = result.current.reorder(2, "TODO", 4096);
    });
    expect(ids(result.current.board, "TODO")).toEqual([3, 1, 2]);

    // B가 먼저 실패한다: A는 아직 응답 전이라 낙관적으로 옮겨진 채로 남는다
    await act(async () => {
      forB.reject(apiError(500, "INTERNAL_ERROR", "서버 오류"));
      await callB;
    });
    expect(ids(result.current.board, "BACKLOG")).toEqual([2]);
    expect(ids(result.current.board, "TODO")).toEqual([3, 1]);

    // A가 성공하면 서버 보드로 확정된다
    const serverBoard = makeBoardOf([{ ...TICKET_A, status: "TODO", position: 1536 }, TICKET_B, TICKET_C]);
    await act(async () => {
      forA.resolve(serverBoard);
      await callA;
    });
    expect(result.current.board).toEqual(serverBoard);
  });

  it("보드에 없는 카드를 이동하려 하면 아무 일도 하지 않는다", async () => {
    const initial = makeInitial();
    const { result } = renderHook(() => useTickets(initial));

    await act(async () => {
      await result.current.reorder(999, "TODO", 1024);
      await result.current.complete(999);
    });

    expect(api.reorderTicket).not.toHaveBeenCalled();
    expect(api.completeTicket).not.toHaveBeenCalled();
    expect(result.current.board).toBe(initial);
  });
});

describe("useTickets — 오류 상태와 언마운트", () => {
  // TC-HOOK-001-10
  it("clearError는 error를 null로 만든다", async () => {
    api.fetchBoard.mockRejectedValue(apiError(500, "INTERNAL_ERROR", "실패"));
    const { result } = renderHook(() => useTickets());
    await waitFor(() => expect(result.current.error).toBe("실패"));

    act(() => result.current.clearError());

    expect(result.current.error).toBeNull();
  });

  // TC-HOOK-001-17
  it("clearError 뒤 같은 실패가 다시 발생하면 error가 다시 채워진다", async () => {
    const failure = apiError(500, "INTERNAL_ERROR", "저장하지 못했습니다");
    api.createTicket.mockRejectedValue(failure);
    const { result } = renderHook(() => useTickets(makeInitial()));

    await act(async () => {
      await result.current.create({ title: "x" }).catch(() => undefined);
    });
    expect(result.current.error).toBe("저장하지 못했습니다");

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.create({ title: "x" }).catch(() => undefined);
    });
    expect(result.current.error).toBe("저장하지 못했습니다");
  });

  // TC-HOOK-001-18
  it("응답이 오기 전에 언마운트되어도 이후 응답이 도착할 때 오류나 경고가 없다", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const initialFetch = deferred<BoardData>();
    api.fetchBoard.mockReturnValue(initialFetch.promise);
    const reorderPending = deferred<BoardData>();
    api.reorderTicket.mockReturnValue(reorderPending.promise);

    const first = renderHook(() => useTickets());
    first.unmount();
    await act(async () => initialFetch.resolve(makeInitial()));

    const second = renderHook(() => useTickets(makeInitial()));
    let call!: Promise<void>;
    act(() => {
      call = second.result.current.reorder(1, "TODO", 1536);
    });
    second.unmount();
    await act(async () => {
      reorderPending.resolve(makeInitial());
      await call;
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
