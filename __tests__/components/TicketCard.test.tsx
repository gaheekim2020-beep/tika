import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { ReactElement } from "react";
import { TicketCard } from "@/client/components/TicketCard";
import { makeTicket } from "../helpers/fixtures";
import { renderWithDnd } from "../helpers/renderWithDnd";

// 센서가 없는 DndContext — 키보드 센서의 Space/Enter 처리 없이 카드 자체의 키 동작만 확인한다 (D6)
const renderWithoutSensors = (ui: ReactElement) =>
  render(
    <DndContext sensors={[]}>
      <SortableContext items={[1]}>{ui}</SortableContext>
    </DndContext>
  );

// 앱과 같은 포인터 센서(distance: 8) — 움직임 없는 클릭은 드래그가 아니라 클릭으로 전달된다 (TRD §1.5)
const AppSensorsContext = ({ children }: { children: ReactElement }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <DndContext sensors={sensors}>
      <SortableContext items={[1]}>{children}</SortableContext>
    </DndContext>
  );
};

describe("TicketCard (§5.1)", () => {
  // TC-COMP-001-01
  it("제목과 우선순위 뱃지가 보인다", () => {
    renderWithDnd(
      <TicketCard ticket={makeTicket({ title: "로그인 페이지 구현", priority: "HIGH" })} onClick={jest.fn()} />,
      [1]
    );

    expect(screen.getByText("로그인 페이지 구현")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  // TC-COMP-001-02
  it("dueDate가 있으면 종료예정일이 'MM-DD' 형식으로 보인다", () => {
    renderWithDnd(<TicketCard ticket={makeTicket({ dueDate: "2026-10-01" })} onClick={jest.fn()} />, [1]);

    expect(screen.getByText("종료예정 10-01")).toBeInTheDocument();
  });

  // TC-COMP-001-03
  it("dueDate가 null이면 종료예정일 텍스트가 보이지 않는다", () => {
    renderWithDnd(<TicketCard ticket={makeTicket({ dueDate: null })} onClick={jest.fn()} />, [1]);

    expect(screen.queryByText(/종료예정/)).not.toBeInTheDocument();
  });

  // TC-COMP-001-04
  it("isOverdue=true이면 '지연' 뱃지와 강조 테두리(.card--overdue)가 보인다", () => {
    renderWithDnd(<TicketCard ticket={makeTicket({ isOverdue: true, dueDate: "2026-09-01" })} onClick={jest.fn()} />, [1]);

    expect(screen.getByRole("img", { name: "지연됨" })).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("card--overdue");
  });

  // TC-COMP-001-05
  it("isOverdue=false이면 '지연' 뱃지와 .card--overdue가 없다", () => {
    renderWithDnd(<TicketCard ticket={makeTicket({ isOverdue: false })} onClick={jest.fn()} />, [1]);

    expect(screen.queryByRole("img", { name: "지연됨" })).not.toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveClass("card--overdue");
  });

  // TC-COMP-001-10
  it("DONE 카드도 제목과 우선순위 뱃지를 같은 방식으로 보여 준다", () => {
    renderWithDnd(
      <TicketCard ticket={makeTicket({ status: "DONE", priority: "HIGH", title: "배포 완료" })} onClick={jest.fn()} />,
      [1]
    );

    expect(screen.getByText("배포 완료")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("card--done");
  });

  // TC-COMP-001-11
  it("DONE 카드는 기한이 지났어도 isOverdue=false면 지연 표시가 없다", () => {
    renderWithDnd(
      <TicketCard ticket={makeTicket({ status: "DONE", dueDate: "2020-01-01", isOverdue: false })} onClick={jest.fn()} />,
      [1]
    );

    expect(screen.queryByRole("img", { name: "지연됨" })).not.toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveClass("card--overdue");
  });

  // TC-COMP-001-12
  it("description=null이면 설명 영역이 렌더링되지 않는다", () => {
    const { container } = renderWithDnd(
      <TicketCard ticket={makeTicket({ description: null })} onClick={jest.fn()} />,
      [1]
    );

    expect(container.querySelector(".card-desc")).toBeNull();
    expect(screen.getByText("샘플 티켓")).toBeInTheDocument();
  });

  // TC-COMP-001-13
  it("description이 있으면 제목 아래에 설명이 보인다", () => {
    const { container } = renderWithDnd(
      <TicketCard ticket={makeTicket({ description: "로그인 화면과 검증 로직을 구현한다" })} onClick={jest.fn()} />,
      [1]
    );

    const desc = screen.getByText("로그인 화면과 검증 로직을 구현한다");
    expect(desc).toHaveClass("card-desc");
    expect(container.querySelector(".card-title")?.nextElementSibling).toBe(desc);
  });

  // TC-COMP-001-14
  it("1000자 설명도 .card-desc로 렌더링된다 (2줄 말줄임은 CSS, 시각 확인은 P7)", () => {
    const description = "가".repeat(1000);
    renderWithDnd(<TicketCard ticket={makeTicket({ description })} onClick={jest.fn()} />, [1]);

    expect(screen.getByText(description)).toHaveClass("card-desc");
  });

  // TC-COMP-001-08
  it("카드를 클릭하면 onClick(ticket)이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const ticket = makeTicket({ title: "클릭 대상" });
    render(
      <AppSensorsContext>
        <TicketCard ticket={ticket} onClick={onClick} />
      </AppSensorsContext>
    );

    await user.click(screen.getByText("클릭 대상"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(ticket);
  });

  // TC-COMP-001-09
  it("포커스 후 Enter를 누르면 onClick(ticket)이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const ticket = makeTicket();
    renderWithoutSensors(<TicketCard ticket={ticket} onClick={onClick} />);

    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(ticket);
  });

  // TC-COMP-001-15
  it("포커스 후 Space를 눌러도 onClick이 호출되지 않는다 (Space는 드래그 픽업 전용, D6)", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithoutSensors(<TicketCard ticket={makeTicket()} onClick={onClick} />);

    await user.tab();
    await user.keyboard(" ");

    expect(onClick).not.toHaveBeenCalled();
  });

  it("role=button, tabIndex=0, 접근 가능한 이름은 '{title}, 우선순위 {priority}'이다", () => {
    renderWithDnd(<TicketCard ticket={makeTicket({ title: "결제 연동", priority: "LOW" })} onClick={jest.fn()} />, [1]);

    const card = screen.getByRole("button", { name: "결제 연동, 우선순위 LOW" });
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("지연된 카드의 접근 가능한 이름에는 ', 지연됨'이 붙는다", () => {
    renderWithDnd(
      <TicketCard ticket={makeTicket({ title: "결제 연동", priority: "HIGH", isOverdue: true })} onClick={jest.fn()} />,
      [1]
    );

    expect(screen.getByRole("button", { name: "결제 연동, 우선순위 HIGH, 지연됨" })).toBeInTheDocument();
  });

  // TC-COMP-001-06 일부
  it("우선순위별로 뱃지 variant가 다르다", () => {
    const variants = (["LOW", "MEDIUM", "HIGH"] as const).map((priority) => {
      const { unmount } = renderWithDnd(<TicketCard ticket={makeTicket({ priority })} onClick={jest.fn()} />, [1]);
      const className = screen.getByText(priority).className;
      unmount();
      return className;
    });

    expect(variants).toEqual(["badge badge--low", "badge badge--medium", "badge badge--high"]);
  });

  it("isOverlay이면 .card--overlay이고 버튼이 아닌 미리보기로 렌더링된다", () => {
    const { container } = renderWithDnd(
      <TicketCard ticket={makeTicket({ title: "끄는 중" })} onClick={jest.fn()} isOverlay />,
      [1]
    );

    expect(container.querySelector(".card--overlay")).toHaveTextContent("끄는 중");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
