import { render } from "@testing-library/react";
import { PREVIEW_PHASES, previewSections } from "@/app/preview/_registry";

// 등록된 모든 프리뷰 섹션이 오류 없이 렌더링되는지 확인한다 (갤러리가 깨지면 화면 확인을 할 수 없다)
describe("프리뷰 섹션 렌더링", () => {
  it.each(previewSections.map((section) => [section.id, section] as const))(
    "%s 섹션이 오류 없이 렌더링된다",
    (_id, section) => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      const { container } = render(<>{section.render()}</>);

      expect(container).not.toBeEmptyDOMElement();
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    }
  );

  it("각 섹션은 확인할 점(note)과 관련 명세(spec)를 적어 둔다", () => {
    previewSections.forEach((section) => {
      expect(section.spec).toBeTruthy();
      expect(section.note).toBeTruthy();
    });
  });

  it("Phase 2 컴포넌트 10개가 모두 등록돼 있다", () => {
    const ids = previewSections.filter((section) => section.phase === "P2").map((section) => section.id);

    expect(ids).toEqual([
      "button",
      "badge",
      "priority-badge",
      "overdue-indicator",
      "empty-column-state",
      "board-skeleton",
      "error-banner",
      "error-toast",
      "modal",
      "confirm-dialog",
    ]);
    expect(PREVIEW_PHASES.some((phase) => phase.id === "P2")).toBe(true);
  });
});
