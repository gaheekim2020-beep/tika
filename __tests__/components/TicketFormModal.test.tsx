import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketFormModal } from "@/client/components/TicketFormModal";

// ApiError(P1)와 같은 모양의 오류: message + 선택적 field
const apiError = (message: string, field?: string) => Object.assign(new Error(message), { field });

describe("TicketFormModal (§6.1)", () => {
  it("isOpen=false이면 아무것도 렌더링하지 않는다", () => {
    render(<TicketFormModal isOpen={false} onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // TC-COMP-006-01
  it("열면 빈 폼이 보이고 우선순위는 MEDIUM이다", () => {
    render(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "새 업무 만들기" })).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveValue("");
    expect(screen.getByLabelText("우선순위")).toHaveValue("MEDIUM");
  });

  // TC-COMP-006-02
  it("열면 제목 입력창에 포커스가 있다", () => {
    render(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.getByLabelText("제목")).toHaveFocus();
  });

  // TC-COMP-006-03
  it("제목만 입력하고 '생성'을 누르면 onSubmit이 { title, priority }로 호출되고 성공 시 닫힌다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("제목"), "새 업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).toHaveBeenCalledWith({ title: "새 업무", priority: "MEDIUM" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  // TC-COMP-006-04
  it("모든 필드를 채우면 모든 필드로 onSubmit이 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("제목"), "결제 연동");
    await user.type(screen.getByLabelText("설명"), "PG사 연동");
    await user.selectOptions(screen.getByLabelText("우선순위"), "HIGH");
    await user.type(screen.getByLabelText("시작예정일"), "2099-01-01");
    await user.type(screen.getByLabelText("종료예정일"), "2099-12-31");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "결제 연동",
      description: "PG사 연동",
      priority: "HIGH",
      plannedStartDate: "2099-01-01",
      dueDate: "2099-12-31",
    });
  });

  // TC-COMP-006-05
  it("'취소'를 누르면 onSubmit 없이 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // TC-COMP-006-05
  it("오버레이 바깥을 클릭하면 onSubmit 없이 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    const { container } = render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.click(container.querySelector(".modal-overlay") as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // TC-COMP-006-06 / 006-07
  it("클라이언트 검증에 실패하면 모달이 유지되고 필드 아래에 오류가 보인다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("서버 400에 field가 있으면 해당 필드 아래에 메시지가 보이고 모달이 유지된다 (D3)", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(apiError("서버가 거절한 제목입니다", "title"));
    const onClose = jest.fn();
    render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    const message = await screen.findByText("서버가 거절한 제목입니다");
    expect(screen.getByLabelText("제목")).toHaveAttribute("aria-describedby", message.id);
    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-006-08
  it("field가 없는 오류는 토스트로 보이고 모달이 유지된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(apiError("티켓을 저장하지 못했습니다"));
    const onClose = jest.fn();
    render(<TicketFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("티켓을 저장하지 못했습니다");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-006-09
  it("제출 중에는 '생성' 버튼이 비활성이다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn(() => new Promise<void>(() => undefined));
    render(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(screen.getByRole("button", { name: "생성" })).toBeDisabled();
  });

  it("닫았다가 다시 열면 이전 오류가 남아 있지 않다", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "생성" }));
    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();

    rerender(<TicketFormModal isOpen={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    rerender(<TicketFormModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.queryByText("제목을 입력해주세요")).not.toBeInTheDocument();
  });
});
