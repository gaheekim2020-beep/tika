import { render, screen } from "@testing-library/react";
import { EmptyColumnState } from "@/client/components/EmptyColumnState";

describe("EmptyColumnState (§8.4)", () => {
  // TC-COMP-011-01
  it("label 문구가 그대로 보인다", () => {
    render(<EmptyColumnState label="아직 카드가 없어요" />);

    expect(screen.getByText("아직 카드가 없어요")).toBeInTheDocument();
  });

  it("전달한 label이 달라지면 그 문구가 보인다", () => {
    render(<EmptyColumnState label="비어 있습니다" />);

    expect(screen.getByText("비어 있습니다")).toBeInTheDocument();
    expect(screen.queryByText("아직 카드가 없어요")).not.toBeInTheDocument();
  });
});
