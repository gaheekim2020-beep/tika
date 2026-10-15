import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteButton } from "@/client/components/DeleteButton";

describe("DeleteButton (§6.3)", () => {
  // TC-COMP-008-01
  it("'삭제' 버튼이 danger variant로 보이고 클릭하면 onClick이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<DeleteButton onClick={onClick} />);

    const button = screen.getByRole("button", { name: "삭제" });
    expect(button).toHaveClass("btn--danger");

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
