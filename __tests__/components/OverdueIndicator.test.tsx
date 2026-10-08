import { render, screen } from "@testing-library/react";
import { OverdueIndicator } from "@/client/components/OverdueIndicator";

describe("OverdueIndicator (§5.3)", () => {
  // TC-COMP-013-03
  it('"지연" 텍스트가 보이고 aria-label="지연됨"이 있으며 overdue 스타일이다', () => {
    render(<OverdueIndicator />);

    const indicator = screen.getByLabelText("지연됨");
    expect(indicator).toHaveTextContent("지연");
    expect(indicator).toHaveClass("badge", "badge--overdue");
  });

  // TC-COMP-013-03: 경고 아이콘
  it("경고 아이콘이 함께 보인다", () => {
    const { container } = render(<OverdueIndicator />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  // TC-COMP-013-04
  it("아이콘은 보조기기에서 숨겨지고 텍스트와 함께 쓰인다 (색상·아이콘에만 의존하지 않음)", () => {
    const { container } = render(<OverdueIndicator />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("지연")).toBeInTheDocument();
  });
});
