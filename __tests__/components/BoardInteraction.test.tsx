import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Board } from "@/client/components/Board";
import { makeBoardOf, makeTicket } from "../helpers/fixtures";

/*
 * DndContext를 mock하지 않고 실제 dnd-kit 센서 위에서 Board의 카드 상호작용을 확인한다.
 * 드래그 이동 자체는 jsdom에 레이아웃이 없어 검증하지 않는다 (Board.test.tsx의 핸들러 호출 테스트와 수동 점검 P7).
 */

const board = makeBoardOf([makeTicket({ id: 1, title: "대상 카드", status: "TODO", position: 1024 })]);

const setup = () => {
  const handlers = { onTicketClick: jest.fn(), onReorder: jest.fn(), onComplete: jest.fn() };
  render(<Board board={board} {...handlers} />);
  return handlers;
};

describe("Board — 실제 센서에서의 카드 상호작용 (D6)", () => {
  // TC-COMP-001-08: 드래그 활성화 거리(8px)보다 적게 움직이는 클릭은 드래그로 오인되지 않는다
  it("카드를 클릭하면 드래그가 아니라 onTicketClick이 호출된다", async () => {
    const user = userEvent.setup();
    const { onTicketClick, onReorder, onComplete } = setup();

    await user.click(screen.getByRole("button", { name: /^대상 카드/ }));

    expect(onTicketClick).toHaveBeenCalledTimes(1);
    expect(onReorder).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  // TC-COMP-001-09
  it("Tab으로 포커스한 카드에서 Enter를 누르면 상세가 열린다 (픽업 키는 Space뿐)", async () => {
    const user = userEvent.setup();
    const { onTicketClick } = setup();

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onTicketClick).toHaveBeenCalledTimes(1);
    expect(onTicketClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("Space로 픽업한 뒤 Enter로 놓을 때는 상세가 열리지 않는다", async () => {
    const user = userEvent.setup();
    const { onTicketClick } = setup();

    await user.tab();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");

    expect(onTicketClick).not.toHaveBeenCalled();
  });
});
