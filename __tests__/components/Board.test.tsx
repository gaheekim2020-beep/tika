import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardCode, KeyboardSensor, PointerSensor, TouchSensor } from "@dnd-kit/core";
import { Board } from "@/client/components/Board";
import { dnd, resetDndMock } from "../helpers/dndMock";
import { makeBoardOf, makeEmptyBoard, makeTicket } from "../helpers/fixtures";

// DndContext/DragOverlay/useSensor만 가짜로 바꿔 Board가 넘기는 핸들러를 직접 호출한다 (FRONTEND_TASKS §1.3)
jest.mock("@dnd-kit/core", () =>
  jest.requireActual<typeof import("../helpers/dndMock")>("../helpers/dndMock").createDndCoreMock()
);

beforeEach(resetDndMock);

// TEST_CASES §3.15 예시 보드: BACKLOG [X], TODO [A, B, C], IN_PROGRESS [], DONE [D]
const X = 10;
const A = 11;
const B = 12;
const C = 13;
const D = 14;

const makeSampleBoard = () =>
  makeBoardOf([
    makeTicket({ id: X, title: "X 카드", status: "BACKLOG", position: 1024 }),
    makeTicket({ id: A, title: "A 카드", status: "TODO", position: 1024 }),
    makeTicket({ id: B, title: "B 카드", status: "TODO", position: 2048 }),
    makeTicket({ id: C, title: "C 카드", status: "TODO", position: 3072 }),
    makeTicket({ id: D, title: "D 카드", status: "DONE", position: 1024 }),
  ]);

const setup = (board = makeSampleBoard()) => {
  const handlers = { onTicketClick: jest.fn(), onReorder: jest.fn(), onComplete: jest.fn() };
  render(<Board board={board} {...handlers} />);
  return handlers;
};

describe("Board — 렌더링 (§3.4)", () => {
  // TC-COMP-003-01
  it("BACKLOG → TODO → IN_PROGRESS → DONE 순서로 4개 칼럼을 렌더링한다", () => {
    setup();

    const names = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));
    expect(names).toEqual(["Backlog 칼럼", "TODO 칼럼", "In Progress 칼럼", "Done 칼럼"]);
  });

  it("티켓이 각 칼럼에 올바르게 나뉘어 보인다", () => {
    setup();

    expect(within(screen.getByRole("region", { name: "Backlog 칼럼" })).getByText("X 카드")).toBeInTheDocument();
    const todo = within(screen.getByRole("region", { name: "TODO 칼럼" }));
    expect(todo.getByText("A 카드")).toBeInTheDocument();
    expect(todo.getByText("B 카드")).toBeInTheDocument();
    expect(todo.getByText("C 카드")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "In Progress 칼럼" })).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Done 칼럼" })).getByText("D 카드")).toBeInTheDocument();
  });

  it("카드를 클릭하면 onTicketClick이 해당 티켓으로 호출된다", async () => {
    const user = userEvent.setup();
    const { onTicketClick } = setup();

    await user.click(screen.getByRole("button", { name: /^B 카드/ }));

    expect(onTicketClick).toHaveBeenCalledWith(expect.objectContaining({ id: B }));
  });

  it("DndContext에 고정 id가 지정된다 (hydration 불일치 방지)", () => {
    setup();

    expect(dnd.props().id).toEqual(expect.any(String));
  });
});

describe("Board — 드롭 처리 (§3.4, §3.6)", () => {
  // TC-COMP-003-02 (칼럼 간)
  it("다른 칼럼의 카드 위에 놓으면 onReorder(id, status, 계산된 position)을 호출한다", () => {
    const { onReorder, onComplete } = setup();

    dnd.start(X);
    dnd.end(X, B);

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(X, "TODO", 1536);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("칼럼 영역에 놓으면 그 칼럼 맨 뒤 position으로 onReorder를 호출한다", () => {
    const { onReorder } = setup();

    dnd.end(X, "column:TODO");

    expect(onReorder).toHaveBeenCalledWith(X, "TODO", 4096);
  });

  // TC-COMP-003-03 (같은 칼럼)
  it("같은 칼럼에서 순서를 바꾸면 이동 카드 자신을 제외하고 position을 계산한다", () => {
    const { onReorder } = setup();

    dnd.end(A, B);

    expect(onReorder).toHaveBeenCalledWith(A, "TODO", 2560);
  });

  // TC-COMP-003-04
  it("DONE 칼럼(또는 DONE의 카드)에 놓으면 onComplete(id)를 호출하고 onReorder는 호출하지 않는다", () => {
    const { onReorder, onComplete } = setup();

    dnd.end(B, "column:DONE");
    dnd.end(A, D);

    expect(onComplete).toHaveBeenNthCalledWith(1, B);
    expect(onComplete).toHaveBeenNthCalledWith(2, A);
    expect(onReorder).not.toHaveBeenCalled();
  });

  // TC-COMP-003-15
  it("DONE 칼럼 안의 이동이나 제자리 드롭은 어느 콜백도 호출하지 않는다", () => {
    const { onReorder, onComplete } = setup();

    dnd.end(D, "column:DONE");
    dnd.end(D, D);
    dnd.end(B, B);

    expect(onReorder).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("DONE에서 다른 칼럼으로 나가는 것은 onReorder로 처리한다", () => {
    const { onReorder } = setup();

    dnd.end(D, "column:TODO");

    expect(onReorder).toHaveBeenCalledWith(D, "TODO", 4096);
  });

  // TC-COMP-003-16
  it("카드가 없는 칼럼에 놓으면 onReorder(id, status, 1024)를 호출한다", () => {
    const { onReorder } = setup();

    dnd.end(X, "column:IN_PROGRESS");

    expect(onReorder).toHaveBeenCalledWith(X, "IN_PROGRESS", 1024);
  });

  // TC-COMP-003-14
  it("보드 바깥(over=null)에 놓으면 콜백을 호출하지 않는다", () => {
    const { onReorder, onComplete } = setup();

    dnd.start(X);
    dnd.end(X, null);

    expect(onReorder).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.querySelector(".card--overlay")).not.toBeInTheDocument();
  });

  // TC-COMP-003-13
  it("드래그를 취소(Esc)하면 콜백을 호출하지 않고 미리보기가 사라진다", () => {
    const { onReorder, onComplete } = setup();

    dnd.start(X);
    expect(document.querySelector(".card--overlay")).toBeInTheDocument();
    dnd.cancel(X);

    expect(onReorder).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.querySelector(".card--overlay")).not.toBeInTheDocument();
  });
});

describe("Board — 드래그 중 표시 (§3.4)", () => {
  // TC-COMP-003-05
  it("드래그를 시작하면 DragOverlay에 해당 카드 미리보기가 보이고, 끝나면 사라진다", () => {
    setup();
    expect(document.querySelector(".card--overlay")).not.toBeInTheDocument();

    dnd.start(B);

    const overlay = document.querySelector(".card--overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent("B 카드");

    dnd.end(B, null);
    expect(document.querySelector(".card--overlay")).not.toBeInTheDocument();
  });

  // TC-COMP-003-06
  it("드래그 중 칼럼 위에 올라가면 그 칼럼이 강조되고 끝나면 꺼진다", () => {
    setup();
    const todo = screen.getByRole("region", { name: "TODO 칼럼" });
    const backlog = screen.getByRole("region", { name: "Backlog 칼럼" });
    expect(todo).not.toHaveClass("column--over");

    dnd.start(X);
    dnd.over(X, "column:TODO");

    expect(todo).toHaveClass("column--over");
    expect(backlog).not.toHaveClass("column--over");

    dnd.end(X, "column:TODO");
    expect(todo).not.toHaveClass("column--over");
  });

  it("카드 위에 올라가도 그 카드가 속한 칼럼이 강조된다", () => {
    setup();

    dnd.start(X);
    dnd.over(X, B);

    expect(screen.getByRole("region", { name: "TODO 칼럼" })).toHaveClass("column--over");
  });

  it("대상이 없으면(보드 바깥) 강조가 꺼진다", () => {
    setup();

    dnd.start(X);
    dnd.over(X, "column:TODO");
    dnd.over(X, null);

    expect(screen.getByRole("region", { name: "TODO 칼럼" })).not.toHaveClass("column--over");
  });

  it("취소하면 강조가 꺼진다", () => {
    setup();

    dnd.start(X);
    dnd.over(X, "column:TODO");
    dnd.cancel(X);

    expect(screen.getByRole("region", { name: "TODO 칼럼" })).not.toHaveClass("column--over");
  });

  it("빈 보드도 4개 칼럼과 빈 상태 문구를 렌더링한다", () => {
    setup(makeEmptyBoard());

    expect(screen.getAllByRole("region")).toHaveLength(4);
    expect(screen.getAllByText("아직 카드가 없어요")).toHaveLength(4);
  });
});

describe("Board — 센서 구성 (TRD §1.5)", () => {
  // TC-COMP-003-11의 자동 검증 범위
  it("PointerSensor(distance 8), TouchSensor(delay 250, tolerance 5), KeyboardSensor를 등록한다", () => {
    setup();

    const [pointer, touch, keyboard] = dnd.sensorCalls();

    expect(pointer).toEqual({ sensor: PointerSensor, options: { activationConstraint: { distance: 8 } } });
    expect(touch).toEqual({ sensor: TouchSensor, options: { activationConstraint: { delay: 250, tolerance: 5 } } });
    expect(keyboard.sensor).toBe(KeyboardSensor);
  });

  // D6: Enter는 카드의 상세 모달 열기에 쓰므로 픽업은 Space만
  it("KeyboardSensor의 시작 키는 Space뿐이고 취소·종료 키는 기본값이다", () => {
    setup();

    const keyboard = dnd.sensorCalls()[2].options as { keyboardCodes: { start: string[]; cancel: string[]; end: string[] } };

    expect(keyboard.keyboardCodes.start).toEqual([KeyboardCode.Space]);
    expect(keyboard.keyboardCodes.cancel).toEqual([KeyboardCode.Esc]);
    expect(keyboard.keyboardCodes.end).toEqual([KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab]);
  });
});
