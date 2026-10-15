import { readError } from "@/client/lib/readError";

describe("readError", () => {
  it("Error의 message를 돌려주고 field는 없다", () => {
    expect(readError(new Error("저장 실패"), "기본 메시지")).toEqual({ message: "저장 실패", field: undefined });
  });

  it("field가 문자열이면 함께 돌려준다 (ApiError 모양)", () => {
    const error = Object.assign(new Error("제목을 입력해주세요"), { field: "title" });

    expect(readError(error, "기본 메시지")).toEqual({ message: "제목을 입력해주세요", field: "title" });
  });

  it("field가 문자열이 아니면 무시한다", () => {
    const error = Object.assign(new Error("실패"), { field: 123 });

    expect(readError(error, "기본 메시지").field).toBeUndefined();
  });

  it("message가 비어 있으면 기본 메시지를 쓴다", () => {
    expect(readError(new Error(""), "기본 메시지").message).toBe("기본 메시지");
  });

  it("Error가 아닌 값이면 기본 메시지를 쓴다", () => {
    expect(readError("문자열 오류", "기본 메시지")).toEqual({ message: "기본 메시지" });
    expect(readError(undefined, "기본 메시지")).toEqual({ message: "기본 메시지" });
    expect(readError(null, "기본 메시지")).toEqual({ message: "기본 메시지" });
  });
});
