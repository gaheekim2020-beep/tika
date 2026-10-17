import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardHeader } from "@/client/components/BoardHeader";
import { NewTicketButton } from "@/client/components/NewTicketButton";
import { SearchInput } from "@/client/components/SearchInput";

describe("BoardHeader (§3.3)", () => {
  // TC-COMP-005-01
  it("상단에 '새 업무' 버튼이 보인다", () => {
    render(<BoardHeader onNewTicketClick={jest.fn()} />);

    expect(screen.getByRole("button", { name: "새 티켓 생성" })).toBeInTheDocument();
    expect(screen.getByText("새 업무")).toBeInTheDocument();
  });

  it("<header>(banner 랜드마크)이고 sticky 상단바 스타일(.topbar)이다", () => {
    render(<BoardHeader onNewTicketClick={jest.fn()} />);

    expect(screen.getByRole("banner")).toHaveClass("topbar");
  });

  it("로고 'Tika'가 보이고 버튼이나 링크가 아니다", () => {
    render(<BoardHeader onNewTicketClick={jest.fn()} />);

    expect(screen.getByText("Tika")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  // TC-COMP-005-02
  it("'새 업무' 버튼을 클릭하면 onNewTicketClick이 한 번 호출된다", async () => {
    const user = userEvent.setup();
    const onNewTicketClick = jest.fn();
    render(<BoardHeader onNewTicketClick={onNewTicketClick} />);

    await user.click(screen.getByRole("button", { name: "새 티켓 생성" }));

    expect(onNewTicketClick).toHaveBeenCalledTimes(1);
  });

  it("검색창과 버튼이 모두 헤더 안에 있다", () => {
    render(<BoardHeader onNewTicketClick={jest.fn()} />);

    const header = screen.getByRole("banner");
    expect(header).toContainElement(screen.getByRole("searchbox", { name: "검색" }));
    expect(header).toContainElement(screen.getByRole("button", { name: "새 티켓 생성" }));
  });
});

describe("NewTicketButton (§3.3)", () => {
  it("화면 텍스트는 '새 업무', 접근 가능한 이름은 '새 티켓 생성'이다", () => {
    render(<NewTicketButton onClick={jest.fn()} />);

    const button = screen.getByRole("button", { name: "새 티켓 생성" });
    expect(button).toHaveTextContent("새 업무");
    expect(screen.queryByRole("button", { name: "새 업무" })).not.toBeInTheDocument();
  });

  it("primary 버튼이고 type=button이다 (폼 안에서 의도치 않게 제출하지 않는다)", () => {
    render(<NewTicketButton onClick={jest.fn()} />);

    const button = screen.getByRole("button", { name: "새 티켓 생성" });
    expect(button).toHaveClass("btn", "btn--primary");
    expect(button).toHaveAttribute("type", "button");
  });

  it("클릭과 키보드(Enter, Space)로 onClick이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<NewTicketButton onClick={onClick} />);

    const button = screen.getByRole("button", { name: "새 티켓 생성" });

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // 클릭하면 이미 포커스가 버튼에 있으므로 tab을 누르면 포커스가 벗어난다. 키보드 입력은 포커스를 직접 준 뒤에 확인한다.
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

describe("SearchInput (§3.3, 2차 구현 예정)", () => {
  // TC-COMP-005-03
  it("비활성 입력창이라 타이핑해도 값이 바뀌지 않는다", async () => {
    const user = userEvent.setup();
    render(<SearchInput />);

    const input = screen.getByRole("searchbox", { name: "검색" });
    await user.type(input, "로그인");

    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });

  it("placeholder로 2차 구현 예정임을 알리고 .search-input 스타일이다", () => {
    render(<SearchInput />);

    const input = screen.getByRole("searchbox", { name: "검색" });
    expect(input).toHaveAttribute("placeholder", "검색 (2차 구현 예정)");
    expect(input).toHaveClass("search-input");
  });
});
