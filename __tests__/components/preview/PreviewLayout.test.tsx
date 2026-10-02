import { render, screen } from "@testing-library/react";
import PreviewLayout from "@/app/preview/layout";

describe("PreviewLayout (/preview 프로덕션 가드)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("개발·테스트 환경에서는 자식을 그대로 렌더링한다", () => {
    render(
      <PreviewLayout>
        <p>프리뷰 내용</p>
      </PreviewLayout>
    );

    expect(screen.getByText("프리뷰 내용")).toBeInTheDocument();
  });

  it("프로덕션에서는 404(notFound)로 처리해 개발용 화면을 노출하지 않는다", () => {
    jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production" });

    expect(() => PreviewLayout({ children: null })).toThrow(/NEXT_(HTTP_ERROR_FALLBACK|NOT_FOUND)/);
  });
});
