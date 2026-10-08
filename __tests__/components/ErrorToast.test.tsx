import { act, render, screen } from "@testing-library/react";
import { ErrorToast } from "@/client/components/ErrorToast";

const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

describe("ErrorToast (§8.3, 결정 D9)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // TC-COMP-012-01
  it("메시지가 경고(role=alert)로 보인다", () => {
    render(<ErrorToast message="티켓을 저장하지 못했습니다" onDismiss={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("티켓을 저장하지 못했습니다");
  });

  // TC-COMP-012-02
  it("4.9초에는 보이고 5초가 지나면 사라지며 onDismiss가 한 번 호출된다", () => {
    const onDismiss = jest.fn();
    render(<ErrorToast message="오류" onDismiss={onDismiss} />);

    advance(4900);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    advance(100);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-012-03
  it("표시 중 메시지가 바뀌면 새 메시지가 보이고 타이머가 다시 시작된다", () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<ErrorToast message="첫 번째 오류" onDismiss={onDismiss} />);

    advance(3000);
    rerender(<ErrorToast message="두 번째 오류" onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent("두 번째 오류");

    // 처음 메시지 기준 5초(= 2초 더)가 지나도 사라지지 않는다
    advance(2000);
    expect(screen.getByRole("alert")).toHaveTextContent("두 번째 오류");
    expect(onDismiss).not.toHaveBeenCalled();

    // 새 메시지 기준 5초가 지나면 사라진다
    advance(3000);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("렌더링마다 onDismiss 함수가 새로 만들어져도 타이머가 다시 시작되지 않는다", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<ErrorToast message="오류" onDismiss={first} />);

    advance(3000);
    rerender(<ErrorToast message="오류" onDismiss={second} />);
    advance(2000);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // 가장 최근에 전달된 함수가 호출된다
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // TC-COMP-012-04
  it("사라지기 전에 언마운트되면 onDismiss가 호출되지 않고 오류도 없다", () => {
    const onDismiss = jest.fn();
    const { unmount } = render(<ErrorToast message="오류" onDismiss={onDismiss} />);

    advance(2000);
    unmount();

    expect(() => advance(10000)).not.toThrow();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
