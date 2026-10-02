import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";

const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onCancel = jest.fn();
  render(
    <ConfirmDialog isOpen title="정말 삭제하시겠습니까?" onConfirm={onConfirm} onCancel={onCancel} {...props} />
  );
  return { onConfirm, onCancel };
};

describe("ConfirmDialog (§8.7, §6.3)", () => {
  // TC-COMP-010-01
  it("열리면 확인 문구와 확인·취소 버튼이 있는 알림 대화상자가 보인다", () => {
    renderDialog();

    expect(screen.getByRole("alertdialog", { name: "정말 삭제하시겠습니까?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  // TC-COMP-010-02, TC-COMP-008-03
  it("열린 직후 취소 버튼에 포커스가 있고 확인 버튼에는 없다 (실수로 Enter를 눌러도 삭제되지 않음)", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "확인" })).not.toHaveFocus();
  });

  // TC-COMP-010-03
  it("확인을 누르면 onConfirm이 한 번 호출되고 onCancel은 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  // TC-COMP-010-04
  it("취소를 누르면 onCancel이 한 번 호출되고 onConfirm은 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // TC-COMP-010-05
  it("Esc를 누르면 onCancel이 호출되고 onConfirm은 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("오버레이 바깥을 클릭해도 onCancel이 호출된다 (Modal 동작 상속)", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(document.querySelector(".modal-overlay") as HTMLElement);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-010-06 (실제 색상은 P7 수동 확인)
  it("danger=true이면 확인 버튼이 danger 스타일, 생략하면 primary 스타일이다", () => {
    const { unmount } = render(
      <ConfirmDialog isOpen title="삭제" danger onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(screen.getByRole("button", { name: "확인" })).toHaveClass("btn--danger");
    unmount();

    renderDialog();
    expect(screen.getByRole("button", { name: "확인" })).toHaveClass("btn--primary");
  });

  // TC-COMP-010-07
  it("isOpen=false이면 화면에 보이지 않는다", () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // TC-COMP-010-08
  it("확인 처리 중에는 확인 버튼이 스피너와 함께 비활성화되고 연속 클릭해도 onConfirm은 한 번만 호출된다", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    renderDialog({ onConfirm });
    const confirm = screen.getByRole("button", { name: "확인" });

    await user.click(confirm);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(confirm.querySelector(".btn-spinner")).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });

  // TC-COMP-010-09
  it("onConfirm이 실패해도 확인 버튼의 로딩이 풀려 다시 누를 수 있고 처리되지 않은 예외로 번지지 않는다", async () => {
    const user = userEvent.setup();
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    const onConfirm = jest.fn().mockRejectedValue(new Error("삭제 실패"));
    renderDialog({ onConfirm });
    const confirm = screen.getByRole("button", { name: "확인" });

    await user.click(confirm);
    await waitFor(() => expect(confirm).not.toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);

    expect(unhandled).not.toHaveBeenCalled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
