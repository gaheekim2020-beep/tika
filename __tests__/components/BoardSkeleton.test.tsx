import { render, screen } from "@testing-library/react";
import { BoardSkeleton } from "@/client/components/BoardSkeleton";

describe("BoardSkeleton (§8.1)", () => {
  // TC-COMP-011-02, TC-COMP-004-02
  it("로딩 중임을 보조기기에 알리고 4개 칼럼 모양의 자리 표시가 보인다", () => {
    render(<BoardSkeleton />);

    const status = screen.getByRole("status", { name: "보드를 불러오는 중" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status.querySelectorAll(".column")).toHaveLength(4);
    expect(status.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("카드 제목 같은 실제 데이터 텍스트는 없다", () => {
    render(<BoardSkeleton />);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("보드와 같은 레이아웃 클래스를 써서 반응형 배치가 실제 보드와 같다", () => {
    render(<BoardSkeleton />);

    expect(screen.getByRole("status").querySelector(".board")).toBeInTheDocument();
  });
});
