import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// 서버 컴포넌트 진입점은 BoardContainer만 렌더링하는지 확인하면 된다 (데이터·상태는 BoardContainer 몫)
jest.mock("@/client/components/BoardContainer", () => ({
  BoardContainer: () => <div data-testid="board-container" />,
}));

describe("app/page.tsx (§3.1)", () => {
  it("BoardContainer를 렌더링한다", () => {
    render(<Home />);

    expect(screen.getByTestId("board-container")).toBeInTheDocument();
  });

  it("기존 템플릿 마크업('칸반 보드 준비 중')이 남아 있지 않다", () => {
    render(<Home />);

    expect(screen.queryByText("칸반 보드 준비 중")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tika" })).not.toBeInTheDocument();
  });

  it("'use client'가 없는 서버 컴포넌트다", () => {
    const source = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf-8");

    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });
});
