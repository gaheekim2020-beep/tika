import { getChangedFields } from "@/client/lib/getChangedFields";
import { makeTicket } from "../helpers/fixtures";

describe("getChangedFields", () => {
  const original = makeTicket({
    title: "기존 제목",
    description: "기존 설명",
    priority: "LOW",
    plannedStartDate: "2099-01-01",
    dueDate: "2099-12-31",
  });

  const unchanged = {
    title: "기존 제목",
    description: "기존 설명",
    priority: "LOW",
    plannedStartDate: "2099-01-01",
    dueDate: "2099-12-31",
  } as const;

  // TC-CLIENT-UTIL-001-21
  it("바뀐 필드가 없으면 빈 객체를 돌려준다", () => {
    expect(getChangedFields(original, unchanged)).toEqual({});
  });

  // TC-CLIENT-UTIL-001-20
  it("바뀐 필드만 담아 돌려준다", () => {
    expect(getChangedFields(original, { ...unchanged, title: "새 제목" })).toEqual({ title: "새 제목" });
  });

  // TC-CLIENT-UTIL-001-20
  it("여러 필드가 바뀌면 모두 담는다", () => {
    expect(getChangedFields(original, { ...unchanged, description: "새 설명", priority: "HIGH", dueDate: "2099-12-01" })).toEqual({
      description: "새 설명",
      priority: "HIGH",
      dueDate: "2099-12-01",
    });
  });

  // TC-CLIENT-UTIL-001-22
  it("값을 지운 필드는 null로 담는다", () => {
    expect(getChangedFields(original, { ...unchanged, description: null, dueDate: null })).toEqual({
      description: null,
      dueDate: null,
    });
  });

  it("원래 null이던 필드가 null 그대로면 바뀐 것으로 보지 않는다", () => {
    const empty = makeTicket({ description: null, plannedStartDate: null, dueDate: null });

    expect(getChangedFields(empty, { title: empty.title, priority: empty.priority, description: null, plannedStartDate: null, dueDate: null })).toEqual({});
  });

  it("values에 없는 필드는 비교하지 않는다", () => {
    expect(getChangedFields(original, { title: "새 제목" })).toEqual({ title: "새 제목" });
  });
});
