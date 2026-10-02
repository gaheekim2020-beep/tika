import { PREVIEW_PHASES, previewSections } from "@/app/preview/_registry";

// 실제 레지스트리를 검증한다. Phase별로 항목이 추가될 때 실수를 바로 잡아 준다.
describe("프리뷰 레지스트리", () => {
  it("Phase 정의의 id가 중복되지 않는다", () => {
    const ids = PREVIEW_PHASES.map((phase) => phase.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("등록된 섹션의 id가 중복되지 않는다", () => {
    const ids = previewSections.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("등록된 섹션은 모두 정의된 Phase에 속한다", () => {
    const phaseIds = new Set<string>(PREVIEW_PHASES.map((phase) => phase.id));

    previewSections.forEach((section) => expect(phaseIds.has(section.phase)).toBe(true));
  });
});
