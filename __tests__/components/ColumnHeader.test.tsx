import { render, screen } from "@testing-library/react";
import { ColumnHeader } from "@/client/components/ColumnHeader";

describe("ColumnHeader (§4.2)", () => {
  // TC-COMP-002-03
  it("label이 보인다", () => {
    render(<ColumnHeader label="In Progress" count={2} />);

    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  // TC-COMP-002-01 일부
  it("count 값이 화면에 표시된다", () => {
    render(<ColumnHeader label="TODO" count={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("카드가 0개여도 0을 보여 준다", () => {
    render(<ColumnHeader label="TODO" count={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("showCount=false이면 숫자가 보이지 않는다 (Backlog용)", () => {
    render(<ColumnHeader label="Backlog" count={5} showCount={false} />);

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });
});
