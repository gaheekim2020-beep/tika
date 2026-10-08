import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketForm } from "@/client/components/TicketForm";
import { makeTicket } from "../helpers/fixtures";

const noop = async () => undefined;

describe("TicketForm — 생성 모드 (§6.2, D5)", () => {
  // TC-COMP-006-01
  it("필드가 비어 있고 우선순위는 MEDIUM이 선택돼 있다", () => {
    render(<TicketForm onSubmit={noop} onCancel={jest.fn()} />);

    expect(screen.getByLabelText("제목")).toHaveValue("");
    expect(screen.getByLabelText("설명")).toHaveValue("");
    expect(screen.getByLabelText("우선순위")).toHaveValue("MEDIUM");
    expect(screen.getByLabelText("시작예정일")).toHaveValue("");
    expect(screen.getByLabelText("종료예정일")).toHaveValue("");
  });

  it("제목만 입력하면 설명·날짜는 본문에서 생략하고 { title, priority }로 제출한다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "새 업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ title: "새 업무", priority: "MEDIUM" });
  });

  // TC-COMP-006-04
  it("모든 필드를 채우면 모든 필드로 제출한다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

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

  // TC-COMP-006-06
  it("제목을 비우고 제출하면 onSubmit이 호출되지 않고 제목 아래에 오류가 보인다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveAttribute("aria-invalid", "true");
  });

  it("공백만 있는 제목은 거절한다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "   ");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();
  });

  // TC-COMP-006-07
  it("과거 종료예정일이면 해당 입력창 아래에 오류가 보이고 제출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.type(screen.getByLabelText("종료예정일"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "생성" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("종료예정일은 오늘 이후 날짜를 선택해주세요")).toBeInTheDocument();
  });

  it("종료예정일 입력에는 min(오늘)이 설정된다", () => {
    render(<TicketForm onSubmit={noop} onCancel={jest.fn()} />);

    const min = screen.getByLabelText("종료예정일").getAttribute("min");
    expect(min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // TC-COMP-006-09
  it("제출이 진행되는 동안 제출 버튼이 비활성이라 중복 제출되지 않고, 끝나면 복구된다", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    const pending = screen.getByRole("button", { name: "생성" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "생성" })).toBeEnabled());
  });

  it("제출이 reject되어도 예외가 번지지 않고 버튼이 복구된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error("실패"));
    render(<TicketForm onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "업무");
    await user.click(screen.getByRole("button", { name: "생성" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "생성" })).toBeEnabled());
  });

  it("'취소'를 누르면 onCancel이 호출되고 onSubmit은 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    render(<TicketForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("TicketForm — errors prop", () => {
  it("errors의 메시지가 해당 필드 아래에 보이고 aria-invalid·aria-describedby로 연결된다", () => {
    render(<TicketForm onSubmit={noop} onCancel={jest.fn()} errors={{ title: "서버가 거절한 제목입니다" }} />);

    const message = screen.getByText("서버가 거절한 제목입니다");
    const input = screen.getByLabelText("제목");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", message.id);
    expect(screen.getByLabelText("설명")).not.toHaveAttribute("aria-invalid");
  });

  it("errors가 없으면 오류 메시지가 없다", () => {
    const { container } = render(<TicketForm onSubmit={noop} onCancel={jest.fn()} />);

    expect(container.querySelector(".form-error")).toBeNull();
  });
});

describe("TicketForm — 수정 모드 (§6.2, D5)", () => {
  const ticket = makeTicket({
    title: "기존 제목",
    description: "기존 설명",
    priority: "LOW",
    plannedStartDate: "2099-01-01",
    dueDate: "2099-12-31",
  });

  // TC-COMP-007-05
  it("기존 값이 입력창에 채워진다", () => {
    render(<TicketForm ticket={ticket} onSubmit={noop} onCancel={jest.fn()} />);

    expect(screen.getByLabelText("제목")).toHaveValue("기존 제목");
    expect(screen.getByLabelText("설명")).toHaveValue("기존 설명");
    expect(screen.getByLabelText("우선순위")).toHaveValue("LOW");
    expect(screen.getByLabelText("시작예정일")).toHaveValue("2099-01-01");
    expect(screen.getByLabelText("종료예정일")).toHaveValue("2099-12-31");
  });

  it("제출 버튼 이름이 '저장'이다", () => {
    render(<TicketForm ticket={ticket} onSubmit={noop} onCancel={jest.fn()} />);

    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "생성" })).not.toBeInTheDocument();
  });

  it("비운 설명·날짜는 null로 전달된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm ticket={ticket} onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.clear(screen.getByLabelText("설명"));
    await user.clear(screen.getByLabelText("시작예정일"));
    await user.clear(screen.getByLabelText("종료예정일"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "기존 제목",
      description: null,
      priority: "LOW",
      plannedStartDate: null,
      dueDate: null,
    });
  });

  // TC-COMP-007-08
  it("제목을 비우고 저장하면 오류가 보이고 제출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm ticket={ticket} onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.clear(screen.getByLabelText("제목"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("제목을 입력해주세요")).toBeInTheDocument();
  });

  // TC-COMP-007-09
  it("종료예정일을 과거 날짜로 바꾸면 오류가 보이고 제출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm ticket={ticket} onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.clear(screen.getByLabelText("종료예정일"));
    await user.type(screen.getByLabelText("종료예정일"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("종료예정일은 오늘 이후 날짜를 선택해주세요")).toBeInTheDocument();
  });

  it("이미 지난 종료예정일을 바꾸지 않으면 검증 오류 없이 제출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const overdue = makeTicket({ title: "지연 티켓", dueDate: "2020-01-01", isOverdue: true });
    render(<TicketForm ticket={overdue} onSubmit={onSubmit} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), " 수정");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.queryByText("종료예정일은 오늘 이후 날짜를 선택해주세요")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "지연 티켓 수정", dueDate: "2020-01-01" }));
  });

  // TC-COMP-007-13
  it("값이 바뀌기 전에는 '저장' 버튼이 비활성이고 Enter로도 제출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm ticket={ticket} onSubmit={onSubmit} onCancel={jest.fn()} />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    await user.type(screen.getByLabelText("제목"), "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // TC-COMP-007-14
  it("값을 바꾸면 '저장' 버튼이 활성이 된다", async () => {
    const user = userEvent.setup();
    render(<TicketForm ticket={ticket} onSubmit={noop} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "!");

    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  // TC-COMP-007-15
  it("원래 값으로 되돌리면 '저장' 버튼이 다시 비활성이 된다", async () => {
    const user = userEvent.setup();
    render(<TicketForm ticket={ticket} onSubmit={noop} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "!");
    await user.type(screen.getByLabelText("제목"), "{Backspace}");

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  // TC-COMP-007-16
  it("제목 앞뒤 공백만 바꾸면 변경으로 보지 않아 '저장' 버튼이 비활성이다", async () => {
    const user = userEvent.setup();
    render(<TicketForm ticket={ticket} onSubmit={noop} onCancel={jest.fn()} />);

    await user.type(screen.getByLabelText("제목"), "  ");

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("생성 모드의 '생성' 버튼은 입력 전에도 활성이다 (제목 오류는 제출 시 안내)", () => {
    render(<TicketForm onSubmit={noop} onCancel={jest.fn()} />);

    expect(screen.getByRole("button", { name: "생성" })).toBeEnabled();
  });
});
