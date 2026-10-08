import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "@/client/components/PriorityBadge";

describe("PriorityBadge (§5.2)", () => {
  // TC-COMP-013-01: 색상에만 의존하지 않고 텍스트로 우선순위를 알린다
  it.each([["LOW"], ["MEDIUM"], ["HIGH"]] as const)("priority=%s이면 같은 텍스트가 보인다", (priority) => {
    render(<PriorityBadge priority={priority} />);

    expect(screen.getByText(priority)).toBeInTheDocument();
  });

  // TC-COMP-013-02 (실제 색상은 P7 수동 확인)
  it.each([
    ["LOW", "badge--low"],
    ["MEDIUM", "badge--medium"],
    ["HIGH", "badge--high"],
  ] as const)("priority=%s이면 %s 스타일이 적용된다", (priority, className) => {
    render(<PriorityBadge priority={priority} />);

    expect(screen.getByText(priority)).toHaveClass("badge", className);
  });
});
