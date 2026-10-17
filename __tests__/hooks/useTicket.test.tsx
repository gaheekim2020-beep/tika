import { act, renderHook } from "@testing-library/react";
import * as ticketApi from "@/client/api/ticketApi";
import { ApiError } from "@/client/api/ticketApi";
import { useTicket } from "@/client/hooks/useTicket";
import { makeTicket } from "../helpers/fixtures";

jest.mock("@/client/api/ticketApi", () => ({
  ...jest.requireActual<typeof import("@/client/api/ticketApi")>("@/client/api/ticketApi"),
  fetchTicket: jest.fn(),
}));

const api = jest.mocked(ticketApi);

// 끝나는 시점을 테스트가 정하는 Promise
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const TICKET_7 = makeTicket({ id: 7, title: "일곱 번째" });
const TICKET_8 = makeTicket({ id: 8, title: "여덟 번째" });

const renderTicketHook = (initialId: number | null) =>
  renderHook(({ ticketId }: { ticketId: number | null }) => useTicket(ticketId), {
    initialProps: { ticketId: initialId },
  });

beforeEach(() => {
  jest.resetAllMocks();
});

describe("useTicket (§3.5)", () => {
  // TC-HOOK-002-01
  it("id가 주어지면 isLoading=true로 시작하고 응답 후 ticket이 채워진다", async () => {
    const pending = deferred<typeof TICKET_7>();
    api.fetchTicket.mockReturnValue(pending.promise);

    const { result } = renderTicketHook(7);

    expect(api.fetchTicket).toHaveBeenCalledWith(7);
    expect(result.current).toEqual({ ticket: null, isLoading: true, error: null });

    await act(async () => pending.resolve(TICKET_7));

    expect(result.current).toEqual({ ticket: TICKET_7, isLoading: false, error: null });
  });

  // TC-HOOK-002-02
  it("id가 null이면 조회하지 않고 ticket=null, isLoading=false다", () => {
    const { result } = renderTicketHook(null);

    expect(api.fetchTicket).not.toHaveBeenCalled();
    expect(result.current).toEqual({ ticket: null, isLoading: false, error: null });
  });

  // TC-HOOK-002-03
  it("id가 바뀌면 새 id로 다시 조회하고, 응답 전에는 이전 티켓을 보여 주지 않는다", async () => {
    api.fetchTicket.mockResolvedValueOnce(TICKET_7);
    const { result, rerender } = renderTicketHook(7);
    await act(async () => undefined);
    expect(result.current.ticket).toEqual(TICKET_7);

    const pending = deferred<typeof TICKET_8>();
    api.fetchTicket.mockReturnValueOnce(pending.promise);
    rerender({ ticketId: 8 });

    // 8번을 기다리는 동안 7번 데이터가 남아 있으면 수정 폼이 옛 값으로 초기화되므로 비워 둔다
    expect(api.fetchTicket).toHaveBeenLastCalledWith(8);
    expect(result.current).toEqual({ ticket: null, isLoading: true, error: null });

    await act(async () => pending.resolve(TICKET_8));

    expect(result.current).toEqual({ ticket: TICKET_8, isLoading: false, error: null });
  });

  // TC-HOOK-002-04
  it("id가 null로 돌아오면 ticket과 error가 비워진다", async () => {
    api.fetchTicket.mockResolvedValueOnce(TICKET_7);
    const { result, rerender } = renderTicketHook(7);
    await act(async () => undefined);
    expect(result.current.ticket).toEqual(TICKET_7);

    rerender({ ticketId: null });

    expect(result.current).toEqual({ ticket: null, isLoading: false, error: null });
  });

  it("실패 상태에서 null로 돌아오면 error도 비워진다", async () => {
    api.fetchTicket.mockRejectedValueOnce(new ApiError({ status: 404, code: "TICKET_NOT_FOUND", message: "없음" }));
    const { result, rerender } = renderTicketHook(7);
    await act(async () => undefined);
    expect(result.current.error).toBe("없음");

    rerender({ ticketId: null });

    expect(result.current).toEqual({ ticket: null, isLoading: false, error: null });
  });

  it("같은 id를 닫았다가 다시 열면 다시 조회하고, 응답 전에는 옛 데이터를 보여 주지 않는다", async () => {
    api.fetchTicket.mockResolvedValueOnce(TICKET_7);
    const { result, rerender } = renderTicketHook(7);
    await act(async () => undefined);
    rerender({ ticketId: null });

    const pending = deferred<typeof TICKET_7>();
    api.fetchTicket.mockReturnValueOnce(pending.promise);
    rerender({ ticketId: 7 });

    expect(api.fetchTicket).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ ticket: null, isLoading: true, error: null });

    const refreshed = { ...TICKET_7, title: "그 사이 다른 곳에서 바뀐 제목" };
    await act(async () => pending.resolve(refreshed));

    expect(result.current.ticket).toEqual(refreshed);
  });

  // TC-HOOK-002-05
  it.each([
    ["404", new ApiError({ status: 404, code: "TICKET_NOT_FOUND", message: "존재하지 않는 티켓입니다" })],
    ["500", new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" })],
  ])("%s 응답이면 error에 메시지가 채워지고 ticket=null, isLoading=false다", async (_label, failure) => {
    api.fetchTicket.mockRejectedValue(failure);

    const { result } = renderTicketHook(7);
    await act(async () => undefined);

    expect(result.current).toEqual({ ticket: null, isLoading: false, error: failure.message });
  });

  it("ApiError가 아닌 예기치 못한 오류에도 기본 메시지를 채운다", async () => {
    api.fetchTicket.mockRejectedValue(new Error(""));

    const { result } = renderTicketHook(7);
    await act(async () => undefined);

    expect(result.current.ticket).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  // TC-HOOK-002-06
  it("7을 요청한 뒤 8로 바뀌면, 늦게 도착한 7의 응답은 무시되고 ticket은 8번이다", async () => {
    const for7 = deferred<typeof TICKET_7>();
    const for8 = deferred<typeof TICKET_8>();
    api.fetchTicket.mockReturnValueOnce(for7.promise).mockReturnValueOnce(for8.promise);

    const { result, rerender } = renderTicketHook(7);
    rerender({ ticketId: 8 });

    await act(async () => for8.resolve(TICKET_8));
    await act(async () => for7.resolve(TICKET_7));

    expect(result.current).toEqual({ ticket: TICKET_8, isLoading: false, error: null });
  });

  it("늦게 도착한 이전 요청의 실패도 새 요청의 결과를 덮어쓰지 않는다", async () => {
    const for7 = deferred<typeof TICKET_7>();
    const for8 = deferred<typeof TICKET_8>();
    api.fetchTicket.mockReturnValueOnce(for7.promise).mockReturnValueOnce(for8.promise);

    const { result, rerender } = renderTicketHook(7);
    rerender({ ticketId: 8 });

    await act(async () => for8.resolve(TICKET_8));
    await act(async () => for7.reject(new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "늦은 실패" })));

    expect(result.current).toEqual({ ticket: TICKET_8, isLoading: false, error: null });
  });

  it("모달을 닫은(null) 뒤에 도착한 응답도 무시한다", async () => {
    const for7 = deferred<typeof TICKET_7>();
    api.fetchTicket.mockReturnValue(for7.promise);

    const { result, rerender } = renderTicketHook(7);
    rerender({ ticketId: null });
    await act(async () => for7.resolve(TICKET_7));

    expect(result.current).toEqual({ ticket: null, isLoading: false, error: null });
  });

  it("응답이 오기 전에 언마운트되어도 이후 응답이 도착할 때 오류나 경고가 없다", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = deferred<typeof TICKET_7>();
    api.fetchTicket.mockReturnValue(pending.promise);

    const { unmount } = renderTicketHook(7);
    unmount();
    await act(async () => pending.resolve(TICKET_7));

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
