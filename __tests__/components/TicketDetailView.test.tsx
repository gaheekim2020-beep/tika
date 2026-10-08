import { render, screen, within } from "@testing-library/react";
import { TicketDetailView } from "@/client/components/TicketDetailView";
import { makeTicket } from "../helpers/fixtures";

const rowOf = (label: string) => screen.getByText(label).closest(".detail-row") as HTMLElement;

describe("TicketDetailView (§6.2)", () => {
  // TC-COMP-007-03 일부
  it("상태, 시작일, 종료일, 생성일이 보인다", () => {
    render(
      <TicketDetailView
        ticket={makeTicket({
          status: "IN_PROGRESS",
          startedAt: new Date(2026, 8, 25, 9, 0),
          completedAt: new Date(2026, 9, 1, 9, 0),
          createdAt: new Date(2026, 8, 20, 9, 0),
        })}
      />
    );

    expect(within(rowOf("상태")).getByText("In Progress")).toBeInTheDocument();
    expect(within(rowOf("시작일")).getByText("2026-09-25")).toBeInTheDocument();
    expect(within(rowOf("종료일")).getByText("2026-10-01")).toBeInTheDocument();
    expect(within(rowOf("생성일")).getByText("2026-09-20")).toBeInTheDocument();
  });

  // TC-COMP-007-04
  it("모두 입력창이 아닌 일반 텍스트다", () => {
    render(<TicketDetailView ticket={makeTicket()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("값이 null인 startedAt/completedAt은 '—'로 보인다", () => {
    render(<TicketDetailView ticket={makeTicket({ startedAt: null, completedAt: null })} />);

    expect(within(rowOf("시작일")).getByText("—")).toBeInTheDocument();
    expect(within(rowOf("종료일")).getByText("—")).toBeInTheDocument();
  });

  it("상태는 Badge가 아닌 텍스트로 표시한다", () => {
    render(<TicketDetailView ticket={makeTicket({ status: "TODO" })} />);

    expect(within(rowOf("상태")).getByText("TODO")).not.toHaveClass("badge");
  });
});
