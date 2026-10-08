import { render, screen } from "@testing-library/react";
import { Badge } from "@/client/components/Badge";

const VARIANTS = ["low", "medium", "high", "overdue", "neutral"] as const;

describe("Badge (§8.6)", () => {
  it("children 텍스트가 보인다", () => {
    render(<Badge variant="low">LOW</Badge>);

    expect(screen.getByText("LOW")).toBeInTheDocument();
  });

  // TC-COMP-009-03 (실제 색상은 P7 수동 확인)
  it.each(VARIANTS)("variant=%s이면 해당 variant 클래스만 가진다", (variant) => {
    render(<Badge variant={variant}>배지</Badge>);

    const badge = screen.getByText("배지");
    expect(badge).toHaveClass("badge", `badge--${variant}`);
    VARIANTS.filter((other) => other !== variant).forEach((other) =>
      expect(badge).not.toHaveClass(`badge--${other}`)
    );
  });

  it("aria-label 같은 나머지 속성을 그대로 전달한다", () => {
    render(
      <Badge variant="overdue" aria-label="지연됨">
        지연
      </Badge>
    );

    expect(screen.getByLabelText("지연됨")).toHaveTextContent("지연");
  });
});
