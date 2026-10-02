import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PreviewPage from "@/app/preview/page";

// 레지스트리가 채워져 가도 이 테스트가 깨지지 않도록 고정된 값으로 대체한다
jest.mock("@/app/preview/_registry", () => ({
  PREVIEW_PHASES: [
    { id: "P2", label: "Phase 2", title: "UI primitive" },
    { id: "P3", label: "Phase 3", title: "카드·칼럼" },
  ],
  previewSections: [
    {
      id: "button",
      phase: "P2",
      title: "Button",
      spec: "COMPONENT_SPEC §8.8",
      render: () => "샘플 본문",
    },
  ],
}));

describe("PreviewPage (/preview)", () => {
  it("페이지 제목과 앱으로 돌아가는 링크가 보인다", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Component Preview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "앱으로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("전체와 Phase별 필터 버튼이 있고 처음에는 전체가 선택돼 있다", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Phase 2" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Phase 3" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Phase별로 묶어 제목을 보여주고 등록된 컴포넌트를 섹션으로 렌더링한다", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Phase 2 · UI primitive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Button" })).toBeInTheDocument();
    expect(screen.getByText("COMPONENT_SPEC §8.8")).toBeInTheDocument();
    expect(screen.getByText("샘플 본문")).toBeInTheDocument();
  });

  it("등록된 컴포넌트가 없는 Phase에는 빈 상태 안내가 보인다", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Phase 3 · 카드·칼럼" })).toBeInTheDocument();
    expect(screen.getAllByText("아직 등록된 컴포넌트가 없습니다")).toHaveLength(1);
  });

  it("Phase 버튼을 누르면 그 Phase만 보이고, 전체를 누르면 모두 다시 보인다", async () => {
    const user = userEvent.setup();
    render(<PreviewPage />);

    await user.click(screen.getByRole("button", { name: "Phase 3" }));

    expect(screen.getByRole("button", { name: "Phase 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { level: 2, name: "Phase 2 · UI primitive" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Phase 3 · 카드·칼럼" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "전체" }));

    expect(screen.getByRole("heading", { level: 2, name: "Phase 2 · UI primitive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Phase 3 · 카드·칼럼" })).toBeInTheDocument();
  });
});
