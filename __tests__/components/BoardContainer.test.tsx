import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as ticketApi from "@/client/api/ticketApi";
import { ApiError } from "@/client/api/ticketApi";
import { BoardContainer } from "@/client/components/BoardContainer";
import type { BoardData } from "@/shared/types";
import { dnd, resetDndMock } from "../helpers/dndMock";
import { makeBoardOf, makeTicket } from "../helpers/fixtures";

// 실제 훅(useTickets, useTicket)을 쓰고 서버 호출(ticketApi)만 가짜로 바꾼다. 드롭은 DndContext를 가짜로 바꿔 핸들러를 직접 호출한다.
jest.mock("@dnd-kit/core", () =>
  jest.requireActual<typeof import("../helpers/dndMock")>("../helpers/dndMock").createDndCoreMock()
);
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

const TICKET_1 = makeTicket({ id: 1, title: "알림 조사", status: "BACKLOG", position: 1024 });
const TICKET_2 = makeTicket({ id: 2, title: "성능 테스트", status: "BACKLOG", position: 2048 });
const TICKET_3 = makeTicket({ id: 3, title: "대시보드 레이아웃", status: "TODO", position: 1024 });
const TICKET_4 = makeTicket({ id: 4, title: "요구사항 정리", status: "DONE", position: 1024 });

const makeInitial = () => makeBoardOf([TICKET_1, TICKET_2, TICKET_3, TICKET_4]);

const region = (name: string) => screen.getByRole("region", { name });
const card = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title}`) });
const serverError = () => new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" });

/** 보드 조회가 성공한 상태로 렌더링하고 첫 카드가 보일 때까지 기다린다 */
const renderLoaded = async (board: BoardData = makeInitial()) => {
  api.fetchBoard.mockResolvedValue(board);
  const user = userEvent.setup();
  render(<BoardContainer />);
  await screen.findByRole("region", { name: "Backlog 칼럼" });
  return user;
};

beforeEach(() => {
  jest.resetAllMocks();
  resetDndMock();
});

describe("BoardContainer — 불러오기 (§3.2)", () => {
  // TC-COMP-004-02
  it("로딩 중에는 스켈레톤이 보이고, 헤더의 '새 업무' 버튼은 항상 보인다", () => {
    api.fetchBoard.mockReturnValue(new Promise(() => undefined));

    render(<BoardContainer />);

    expect(screen.getByRole("status", { name: "보드를 불러오는 중" })).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 티켓 생성" })).toBeInTheDocument();
  });

  // TC-COMP-004-01
  it("로딩이 끝나면 스켈레톤이 사라지고 4개 칼럼과 카드가 보인다", async () => {
    await renderLoaded();

    expect(screen.queryByRole("status", { name: "보드를 불러오는 중" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region").map((section) => section.getAttribute("aria-label"))).toEqual([
      "Backlog 칼럼",
      "TODO 칼럼",
      "In Progress 칼럼",
      "Done 칼럼",
    ]);
    expect(within(region("Backlog 칼럼")).getByText("알림 조사")).toBeInTheDocument();
    expect(within(region("Done 칼럼")).getByText("요구사항 정리")).toBeInTheDocument();
  });

  // TC-COMP-004-03
  it("초기 조회가 실패하면 칼럼 대신 오류 메시지와 '재시도' 버튼이 보인다", async () => {
    api.fetchBoard.mockRejectedValue(new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "티켓 목록을 불러오지 못했습니다" }));

    render(<BoardContainer />);

    expect(await screen.findByRole("alert")).toHaveTextContent("티켓 목록을 불러오지 못했습니다");
    expect(screen.getByRole("button", { name: "재시도" })).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 티켓 생성" })).toBeInTheDocument();
  });

  // TC-COMP-004-04
  it("'재시도'를 누르면 다시 조회해 성공하면 보드 화면으로 전환된다", async () => {
    api.fetchBoard.mockRejectedValueOnce(serverError()).mockResolvedValueOnce(makeInitial());
    const user = userEvent.setup();
    render(<BoardContainer />);

    await user.click(await screen.findByRole("button", { name: "재시도" }));

    expect(await screen.findByRole("region", { name: "Backlog 칼럼" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.fetchBoard).toHaveBeenCalledTimes(2);
  });
});

describe("BoardContainer — 생성 (TC-COMP-005-02, 006-03)", () => {
  it("'새 업무'를 누르면 생성 모달이 열리고, 제출에 성공하면 닫히며 BACKLOG 맨 위에 카드가 보인다", async () => {
    const user = await renderLoaded();
    api.createTicket.mockResolvedValue(makeTicket({ id: 99, title: "새 티켓", status: "BACKLOG", position: 0 }));

    await user.click(screen.getByRole("button", { name: "새 티켓 생성" }));
    const dialog = screen.getByRole("dialog", { name: "새 업무 만들기" });
    await user.type(within(dialog).getByLabelText("제목"), "새 티켓");
    await user.click(within(dialog).getByRole("button", { name: "생성" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.createTicket).toHaveBeenCalledWith({ title: "새 티켓", priority: "MEDIUM" });
    const backlogTitles = within(region("Backlog 칼럼"))
      .getAllByRole("button")
      .map((item) => item.querySelector(".card-title")?.textContent);
    expect(backlogTitles).toEqual(["새 티켓", "알림 조사", "성능 테스트"]);
  });

  it("저장에 실패하면 모달이 열린 채 모달 안에 토스트 하나만 보이고 보드는 에러 화면으로 바뀌지 않는다", async () => {
    const user = await renderLoaded();
    api.createTicket.mockRejectedValue(serverError());

    await user.click(screen.getByRole("button", { name: "새 티켓 생성" }));
    const dialog = screen.getByRole("dialog", { name: "새 업무 만들기" });
    await user.type(within(dialog).getByLabelText("제목"), "새 티켓");
    await user.click(within(dialog).getByRole("button", { name: "생성" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("서버 오류가 발생했습니다");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "새 업무 만들기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument();
    expect(region("Backlog 칼럼")).toBeInTheDocument();
  });

  it("필드 오류(400)는 입력창 아래에만 표시하고 토스트는 띄우지 않는다", async () => {
    const user = await renderLoaded();
    api.createTicket.mockRejectedValue(
      new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "서버가 거절한 제목입니다", field: "title" })
    );

    await user.click(screen.getByRole("button", { name: "새 티켓 생성" }));
    const dialog = screen.getByRole("dialog", { name: "새 업무 만들기" });
    await user.type(within(dialog).getByLabelText("제목"), "새 티켓");
    await user.click(within(dialog).getByRole("button", { name: "생성" }));

    expect(await within(dialog).findByText("서버가 거절한 제목입니다")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("BoardContainer — 상세·수정·삭제 (TC-COMP-001-08, 007, 008)", () => {
  it("카드를 클릭하면 그 id로 상세를 조회하고, 응답 전에는 스켈레톤, 응답 후에는 수정 폼이 보인다", async () => {
    const user = await renderLoaded();
    const pending = deferred<typeof TICKET_1>();
    api.fetchTicket.mockReturnValue(pending.promise);

    await user.click(card("알림 조사"));

    expect(api.fetchTicket).toHaveBeenCalledWith(1);
    expect(screen.getByRole("dialog", { name: "업무 상세" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "상세 정보를 불러오는 중" })).toBeInTheDocument();

    pending.resolve(TICKET_1);

    expect(await screen.findByLabelText("제목")).toHaveValue("알림 조사");
    expect(screen.queryByRole("status", { name: "상세 정보를 불러오는 중" })).not.toBeInTheDocument();
  });

  it("조회에 실패하면 모달 안에 오류 메시지가 보이고 폼은 없다 (TC-COMP-007-12)", async () => {
    const user = await renderLoaded();
    api.fetchTicket.mockRejectedValue(new ApiError({ status: 404, code: "TICKET_NOT_FOUND", message: "존재하지 않거나 삭제된 티켓입니다" }));

    await user.click(card("알림 조사"));

    const dialog = screen.getByRole("dialog", { name: "업무 상세" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("존재하지 않거나 삭제된 티켓입니다");
    expect(within(dialog).queryByLabelText("제목")).not.toBeInTheDocument();
  });

  it("제목을 고쳐 저장하면 바뀐 필드만 보내고, 모달이 닫히며 보드의 카드가 서버 응답으로 바뀐다", async () => {
    const user = await renderLoaded();
    api.fetchTicket.mockResolvedValue(TICKET_1);
    api.updateTicket.mockResolvedValue({ ...TICKET_1, title: "수정한 제목" });

    await user.click(card("알림 조사"));
    const title = await screen.findByLabelText("제목");
    await user.clear(title);
    await user.type(title, "수정한 제목");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.updateTicket).toHaveBeenCalledWith(1, { title: "수정한 제목" });
    expect(within(region("Backlog 칼럼")).getByText("수정한 제목")).toBeInTheDocument();
    expect(within(region("Backlog 칼럼")).queryByText("알림 조사")).not.toBeInTheDocument();
  });

  it("취소로 닫았다가 같은 카드를 다시 열면 다시 조회한다", async () => {
    const user = await renderLoaded();
    api.fetchTicket.mockResolvedValue(TICKET_1);

    await user.click(card("알림 조사"));
    await user.click(await screen.findByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(card("알림 조사"));

    expect(await screen.findByLabelText("제목")).toHaveValue("알림 조사");
    expect(api.fetchTicket).toHaveBeenCalledTimes(2);
  });

  // TC-COMP-008-04
  it("삭제를 확인하면 두 모달이 모두 닫히고 보드에서 카드가 사라진다", async () => {
    const user = await renderLoaded();
    api.fetchTicket.mockResolvedValue(TICKET_1);
    api.deleteTicket.mockResolvedValue(undefined);

    await user.click(card("알림 조사"));
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(api.deleteTicket).toHaveBeenCalledWith(1);
    expect(within(region("Backlog 칼럼")).queryByText("알림 조사")).not.toBeInTheDocument();
  });

  // TC-COMP-008-06
  it("삭제에 실패하면 확인 다이얼로그와 상세 모달을 모두 유지하고 토스트 하나만 보이며 카드는 남는다", async () => {
    const user = await renderLoaded();
    api.fetchTicket.mockResolvedValue(TICKET_1);
    api.deleteTicket.mockRejectedValue(serverError());

    await user.click(card("알림 조사"));
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));

    expect(await screen.findByText("서버 오류가 발생했습니다")).toBeInTheDocument();
    expect(screen.getAllByText("서버 오류가 발생했습니다")).toHaveLength(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "업무 상세" })).toBeInTheDocument();
    expect(within(region("Backlog 칼럼")).getByText("알림 조사")).toBeInTheDocument();
  });
});

describe("BoardContainer — 드롭 연결 (§3.4, §7)", () => {
  it("다른 칼럼에 놓으면 useTickets.reorder로 연결되어 즉시 화면이 바뀌고 서버 호출이 간다", async () => {
    await renderLoaded();
    const pending = deferred<BoardData>();
    api.reorderTicket.mockReturnValue(pending.promise);

    dnd.end(1, "column:TODO");

    // TODO에는 카드 3(position 1024)만 있으므로 맨 뒤는 2048
    expect(api.reorderTicket).toHaveBeenCalledWith({ ticketId: 1, status: "TODO", position: 2048 });
    expect(within(region("TODO 칼럼")).getByText("알림 조사")).toBeInTheDocument();
    expect(within(region("Backlog 칼럼")).queryByText("알림 조사")).not.toBeInTheDocument();

    pending.resolve(makeBoardOf([TICKET_2, TICKET_3, { ...TICKET_1, status: "TODO", position: 2048 }, TICKET_4]));
    await waitFor(() => expect(within(region("TODO 칼럼")).getByText("알림 조사")).toBeInTheDocument());
  });

  it("DONE 칼럼에 놓으면 useTickets.complete로 연결되어 즉시 DONE 맨 위로 옮겨진다", async () => {
    await renderLoaded();
    api.completeTicket.mockReturnValue(new Promise(() => undefined));

    dnd.end(3, "column:DONE");

    expect(api.completeTicket).toHaveBeenCalledWith(3);
    expect(api.reorderTicket).not.toHaveBeenCalled();
    const doneTitles = within(region("Done 칼럼"))
      .getAllByRole("button")
      .map((item) => item.querySelector(".card-title")?.textContent);
    expect(doneTitles).toEqual(["대시보드 레이아웃", "요구사항 정리"]);
  });

  // TC-COMP-003-12
  it("이동 요청이 실패하면 카드가 원래 칼럼으로 조용히 돌아가고 오류 화면이나 토스트는 없다", async () => {
    await renderLoaded();
    api.reorderTicket.mockRejectedValue(serverError());

    dnd.end(1, "column:TODO");

    await waitFor(() => expect(within(region("Backlog 칼럼")).getByText("알림 조사")).toBeInTheDocument());
    expect(within(region("TODO 칼럼")).queryByText("알림 조사")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument();
  });
});
