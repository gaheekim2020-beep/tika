import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Column } from "@/client/components/Column";
import { makeTicket } from "../helpers/fixtures";

const threeTickets = [
  makeTicket({ id: 1, title: "첫 번째", status: "TODO", position: 1024 }),
  makeTicket({ id: 2, title: "두 번째", status: "TODO", position: 2048 }),
  makeTicket({ id: 3, title: "세 번째", status: "TODO", position: 3072 }),
];

describe("Column (§4.1)", () => {
  // TC-COMP-002-01
  it("카드 3개와 헤더 숫자 '3'이 보인다", () => {
    render(<Column status="TODO" tickets={threeTickets} onTicketClick={jest.fn()} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  // TC-COMP-002-02
  it("전달된 순서 그대로 위에서 아래로 렌더링한다", () => {
    render(<Column status="TODO" tickets={threeTickets} onTicketClick={jest.fn()} />);

    const titles = screen.getAllByRole("button").map((card) => card.querySelector(".card-title")?.textContent);
    expect(titles).toEqual(["첫 번째", "두 번째", "세 번째"]);
  });

  // TC-COMP-002-03
  it("status에 맞는 라벨(In Progress)이 헤더에 보인다", () => {
    render(<Column status="IN_PROGRESS" tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "In Progress" })).toBeInTheDocument();
  });

  // TC-COMP-002-06
  it("tickets=[]이면 빈 상태 문구가 보이고 카드는 없다", () => {
    render(<Column status="TODO" tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.getByText("아직 카드가 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("카드가 있으면 빈 상태 문구가 보이지 않는다", () => {
    render(<Column status="TODO" tickets={threeTickets} onTicketClick={jest.fn()} />);

    expect(screen.queryByText("아직 카드가 없어요")).not.toBeInTheDocument();
  });

  // TC-COMP-002-04
  it("DONE 칼럼에는 24시간 안내 문구가 보인다", () => {
    render(<Column status="DONE" tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.getByText("24시간 지난 완료 항목은 표시되지 않아요")).toBeInTheDocument();
  });

  // TC-COMP-002-05
  it.each(["BACKLOG", "TODO", "IN_PROGRESS"] as const)("%s 칼럼에는 24시간 안내 문구가 없다", (status) => {
    render(<Column status={status} tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.queryByText(/24시간/)).not.toBeInTheDocument();
  });

  it("'{칼럼명} 칼럼' 이름의 영역(region)이 있다 (§11)", () => {
    render(<Column status="IN_PROGRESS" tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.getByRole("region", { name: "In Progress 칼럼" })).toBeInTheDocument();
  });

  it("카드 클릭이 onTicketClick(ticket)으로 전달된다", async () => {
    const user = userEvent.setup();
    const onTicketClick = jest.fn();
    render(<Column status="TODO" tickets={threeTickets} onTicketClick={onTicketClick} />);

    const card = screen.getByRole("button", { name: /두 번째/ });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onTicketClick).toHaveBeenCalledWith(threeTickets[1]);
  });

  it("BACKLOG는 .column--backlog이고 카드 수를 보여 주지 않는다", () => {
    const backlog = [makeTicket({ id: 1, title: "아이디어" }), makeTicket({ id: 2, title: "조사" })];
    render(<Column status="BACKLOG" tickets={backlog} onTicketClick={jest.fn()} />);

    const region = screen.getByRole("region", { name: "Backlog 칼럼" });
    expect(region).toHaveClass("column--backlog");
    expect(within(region).queryByText("2")).not.toBeInTheDocument();
  });

  it("BACKLOG가 아닌 칼럼에는 .column--backlog가 없다", () => {
    render(<Column status="TODO" tickets={[]} onTicketClick={jest.fn()} />);

    expect(screen.getByRole("region", { name: "TODO 칼럼" })).not.toHaveClass("column--backlog");
  });
});
