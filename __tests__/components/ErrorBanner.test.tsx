import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "@/client/components/ErrorBanner";

describe("ErrorBanner (§8.2)", () => {
  // TC-COMP-011-03
  it("메시지와 재시도 버튼이 보이고 경고(role=alert)로 전달된다", () => {
    render(<ErrorBanner message="티켓 목록을 불러오지 못했습니다" onRetry={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("티켓 목록을 불러오지 못했습니다");
    expect(screen.getByRole("button", { name: "재시도" })).toBeInTheDocument();
  });

  // TC-COMP-011-04
  it("재시도를 누르면 onRetry가 한 번 호출된다", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<ErrorBanner message="오류" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "재시도" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
