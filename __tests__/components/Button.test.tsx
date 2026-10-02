import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/client/components/Button";

const VARIANTS = ["primary", "secondary", "danger", "ghost"] as const;

describe("Button (§8.8)", () => {
  it("children을 보여주고 기본값은 primary · md · type=button이다", () => {
    render(<Button>저장</Button>);

    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toHaveClass("btn", "btn--primary");
    expect(button).not.toHaveClass("btn--sm");
    expect(button).not.toHaveClass("btn--lg");
    expect(button).toHaveAttribute("type", "button");
  });

  // TC-COMP-009-04
  it.each(VARIANTS)("variant=%s이면 해당 variant 클래스만 가진다", (variant) => {
    render(<Button variant={variant}>버튼</Button>);

    const button = screen.getByRole("button", { name: "버튼" });
    expect(button).toHaveClass(`btn--${variant}`);
    VARIANTS.filter((other) => other !== variant).forEach((other) =>
      expect(button).not.toHaveClass(`btn--${other}`)
    );
  });

  it.each([
    ["sm", "btn--sm"],
    ["lg", "btn--lg"],
  ] as const)("size=%s이면 %s 클래스가 붙는다", (size, className) => {
    render(<Button size={size}>버튼</Button>);

    expect(screen.getByRole("button", { name: "버튼" })).toHaveClass(className);
  });

  it("클릭하면 onClick이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>저장</Button>);

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-009-05
  it("isLoading=true이면 스피너가 보이고 비활성이며 클릭해도 onClick이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const { container } = render(
      <Button isLoading onClick={onClick}>
        저장
      </Button>
    );

    const button = screen.getByRole("button", { name: "저장" });
    expect(container.querySelector(".btn-spinner")).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("isLoading이 아니면 스피너와 aria-busy가 없다", () => {
    const { container } = render(<Button>저장</Button>);

    expect(container.querySelector(".btn-spinner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).not.toHaveAttribute("aria-busy");
  });

  // TC-COMP-009-07
  it("onClick이 없어도 클릭 시 오류가 없다", async () => {
    const user = userEvent.setup();
    render(<Button>저장</Button>);

    await expect(user.click(screen.getByRole("button", { name: "저장" }))).resolves.toBeUndefined();
  });

  it("disabled이면 클릭해도 onClick이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        저장
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("type=submit과 aria-label 같은 나머지 button 속성을 그대로 전달한다", () => {
    render(
      <Button type="submit" aria-label="새 티켓 생성">
        새 업무
      </Button>
    );

    const button = screen.getByRole("button", { name: "새 티켓 생성" });
    expect(button).toHaveAttribute("type", "submit");
  });
});
