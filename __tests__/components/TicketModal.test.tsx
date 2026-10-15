import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { TicketModal } from "@/client/components/TicketModal";
import { makeTicket } from "../helpers/fixtures";

// ApiError(P1)와 같은 모양의 오류: message + 선택적 field
const apiError = (message: string, field?: string) => Object.assign(new Error(message), { field });

const ticket = makeTicket({
  id: 7,
  title: "결제 연동",
  description: "PG사 연동",
  priority: "HIGH",
  dueDate: "2099-12-31",
});

const renderModal = (props: Partial<ComponentProps<typeof TicketModal>> = {}) => {
  const handlers = {
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
  };

  render(<TicketModal isOpen ticket={ticket} isLoading={false} error={null} {...handlers} {...props} />);

  return handlers;
};

describe("TicketModal (§6.2) — 표시", () => {
  it("isOpen=false이면 아무것도 렌더링하지 않는다", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // TC-COMP-007-01
  it("isLoading=true이면 모달은 열려 있고 스켈레톤만 보인다 (폼·삭제 버튼 없음)", () => {
    renderModal({ ticket: null, isLoading: true });

    expect(screen.getByRole("dialog", { name: "업무 상세" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "상세 정보를 불러오는 중" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
  });

  // TC-COMP-007-02 / 007-03 / 008-01
  it("ticket이 주어지면 스켈레톤이 없고 상세 정보와 폼, 삭제 버튼이 보인다", () => {
    renderModal();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("상태")).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveValue("결제 연동");
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  // TC-COMP-007-12
  it("error가 있으면 모달 안에 오류 메시지가 보이고 폼과 삭제 버튼은 없다", () => {
    renderModal({ ticket: null, error: "존재하지 않거나 삭제된 티켓입니다" });

    expect(screen.getByRole("alert")).toHaveTextContent("존재하지 않거나 삭제된 티켓입니다");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
  });
});

describe("TicketModal (§6.2) — 수정", () => {
  // TC-COMP-007-06
  it("변경한 필드만 담아 onSubmit(id, 변경분)이 호출되고 성공 시 닫힌다", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal();

    await user.clear(screen.getByLabelText("제목"));
    await user.type(screen.getByLabelText("제목"), "새 제목");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(7, { title: "새 제목" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  // TC-COMP-007-07
  it("여러 필드를 바꾸면 바뀐 필드를 모두 담는다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.clear(screen.getByLabelText("설명"));
    await user.type(screen.getByLabelText("설명"), "새 설명");
    await user.selectOptions(screen.getByLabelText("우선순위"), "LOW");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(7, { description: "새 설명", priority: "LOW" });
  });

  // TC-COMP-007-13
  it("값을 바꾸기 전에는 '저장' 버튼이 비활성이다", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  // TC-COMP-007-08 / 007-09
  it("검증에 실패하면 모달이 유지되고 필드 아래에 오류가 보인다", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal();

    await user.clear(screen.getByLabelText("제목"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-007-10
  it("저장이 실패하면 모달이 유지되고 오류 토스트가 보인다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ onSubmit: jest.fn().mockRejectedValue(apiError("티켓을 저장하지 못했습니다")) });

    await user.clear(screen.getByLabelText("제목"));
    await user.type(screen.getByLabelText("제목"), "새 제목");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("티켓을 저장하지 못했습니다");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("서버 400에 field가 있으면 해당 필드 아래에 메시지가 보인다", async () => {
    const user = userEvent.setup();
    renderModal({ onSubmit: jest.fn().mockRejectedValue(apiError("서버가 거절한 제목입니다", "title")) });

    await user.type(screen.getByLabelText("제목"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    const message = await screen.findByText("서버가 거절한 제목입니다");
    expect(screen.getByLabelText("제목")).toHaveAttribute("aria-describedby", message.id);
  });

  // TC-COMP-007-11
  it("Esc로 닫으면 onSubmit 없이 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("'취소'를 누르면 onSubmit 없이 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("TicketModal (§6.3) — 삭제", () => {
  // TC-COMP-008-02 / 008-03
  it("'삭제'를 누르면 확인 다이얼로그가 열리고 '취소'에 포커스가 있다", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "삭제" }));

    const confirm = screen.getByRole("alertdialog", { name: "정말 삭제하시겠습니까?" });
    expect(within(confirm).getByRole("button", { name: "취소" })).toHaveFocus();
  });

  // TC-COMP-008-04
  it("확인하면 onDelete(id)가 호출되고 성공 시 두 모달이 모두 닫힌다", async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));

    expect(onDelete).toHaveBeenCalledWith(7);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // TC-COMP-008-05
  it("취소하면 확인 다이얼로그만 닫히고 상세 모달은 유지된다", async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-008-06
  it("삭제가 실패하면 두 모달이 유지되고 오류 토스트가 보인다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ onDelete: jest.fn().mockRejectedValue(apiError("티켓을 삭제하지 못했습니다")) });

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));

    expect(await screen.findByText("티켓을 삭제하지 못했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
