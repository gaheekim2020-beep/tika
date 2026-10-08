import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Modal } from "@/client/components/Modal";

const overlayOf = (container: HTMLElement) => container.querySelector(".modal-overlay") as HTMLElement;

describe("Modal (§8.5)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  // TC-COMP-009-06
  it("isOpen=false이면 모달과 오버레이가 화면에 없다", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()}>
        <p>모달 내용</p>
      </Modal>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("모달 내용")).not.toBeInTheDocument();
    expect(overlayOf(container)).toBeNull();
  });

  // TC-COMP-009-12
  it("isOpen=true이면 role=dialog, aria-modal=true로 children이 보인다", () => {
    render(
      <Modal isOpen onClose={jest.fn()}>
        <p>모달 내용</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("모달 내용");
  });

  // TC-COMP-009-12
  it("role=alertdialog와 aria-labelledby로 접근 가능한 이름을 줄 수 있다", () => {
    render(
      <Modal isOpen onClose={jest.fn()} role="alertdialog" ariaLabelledBy="title">
        <h2 id="title">삭제 확인</h2>
      </Modal>
    );

    expect(screen.getByRole("alertdialog", { name: "삭제 확인" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // TC-COMP-009-12
  it("ariaLabel로 접근 가능한 이름을 줄 수 있다", () => {
    render(
      <Modal isOpen onClose={jest.fn()} ariaLabel="새 업무 만들기">
        <p>내용</p>
      </Modal>
    );

    expect(screen.getByRole("dialog", { name: "새 업무 만들기" })).toBeInTheDocument();
  });

  // TC-COMP-009-02
  it("오버레이 바깥을 클릭하면 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose}>
        <p>모달 내용</p>
      </Modal>
    );

    await user.click(overlayOf(container));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-009-09
  it("모달 내부를 클릭하면 onClose가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <p>모달 내용</p>
      </Modal>
    );

    await user.click(screen.getByText("모달 내용"));
    await user.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-009-09
  it("모달 안에서 눌러 바깥으로 끌어다 놓아도(텍스트 선택 등) 닫히지 않는다", () => {
    const onClose = jest.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose}>
        <p>모달 내용</p>
      </Modal>
    );

    fireEvent.mouseDown(screen.getByText("모달 내용"));
    fireEvent.click(overlayOf(container));

    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-009-08
  it("Esc를 누르면 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <p>모달 내용</p>
      </Modal>
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-009-08
  it("닫혀 있을 때는 Esc에 반응하지 않는다", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen={false} onClose={onClose}>
        <p>모달 내용</p>
      </Modal>
    );

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  // TC-COMP-009-11
  it("모달이 겹쳐 열려 있으면 Esc는 가장 위(나중에 열린) 모달만 닫는다", async () => {
    const user = userEvent.setup();
    const closeOuter = jest.fn();
    const closeInner = jest.fn();
    const Stack = ({ innerOpen }: { innerOpen: boolean }) => (
      <Modal isOpen onClose={closeOuter}>
        <p>바깥 모달</p>
        <Modal isOpen={innerOpen} onClose={closeInner}>
          <p>안쪽 모달</p>
        </Modal>
      </Modal>
    );
    const { rerender } = render(<Stack innerOpen={false} />);
    rerender(<Stack innerOpen />);

    await user.keyboard("{Escape}");
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    rerender(<Stack innerOpen={false} />);
    await user.keyboard("{Escape}");
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });

  // TC-COMP-009-01
  describe("배경 스크롤 잠금", () => {
    it("열려 있는 동안 body 스크롤이 잠기고 닫히면 원래 값으로 복구된다", () => {
      document.body.style.overflow = "scroll";
      const { rerender } = render(
        <Modal isOpen onClose={jest.fn()}>
          <p>내용</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={jest.fn()}>
          <p>내용</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe("scroll");
    });

    it("언마운트되어도 복구된다", () => {
      const { unmount } = render(
        <Modal isOpen onClose={jest.fn()}>
          <p>내용</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });

    // TC-COMP-009-13
    it("모달이 둘 열려 있을 때 하나를 닫아도 잠금은 유지되고 모두 닫으면 복구된다", () => {
      document.body.style.overflow = "scroll";
      const Two = ({ first, second }: { first: boolean; second: boolean }) => (
        <>
          <Modal isOpen={first} onClose={jest.fn()}>
            <p>첫 번째</p>
          </Modal>
          <Modal isOpen={second} onClose={jest.fn()}>
            <p>두 번째</p>
          </Modal>
        </>
      );
      const { rerender } = render(<Two first second />);

      rerender(<Two first={false} second />);
      expect(document.body.style.overflow).toBe("hidden");

      rerender(<Two first={false} second={false} />);
      expect(document.body.style.overflow).toBe("scroll");
    });
  });

  // TC-COMP-009-10
  describe("포커스", () => {
    it("열리면 내부 첫 포커스 가능 요소로 포커스가 이동한다", () => {
      render(
        <Modal isOpen onClose={jest.fn()}>
          <button type="button">첫 번째</button>
          <button type="button">두 번째</button>
        </Modal>
      );

      expect(screen.getByRole("button", { name: "첫 번째" })).toHaveFocus();
    });

    it("비활성 요소는 건너뛰고 다음 포커스 가능 요소로 이동한다", () => {
      render(
        <Modal isOpen onClose={jest.fn()}>
          <button type="button" disabled>
            비활성
          </button>
          <input aria-label="제목" />
        </Modal>
      );

      expect(screen.getByLabelText("제목")).toHaveFocus();
    });

    it("포커스 가능 요소가 없으면 모달 자체가 포커스를 받는다", () => {
      render(
        <Modal isOpen onClose={jest.fn()}>
          <p>읽기 전용</p>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toHaveFocus();
    });

    it("닫히면 열기 전에 포커스가 있던 요소로 포커스가 돌아간다", async () => {
      const user = userEvent.setup();
      const Harness = () => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              열기
            </button>
            <Modal isOpen={open} onClose={() => setOpen(false)}>
              <button type="button">안쪽 버튼</button>
            </Modal>
          </>
        );
      };
      render(<Harness />);

      await user.click(screen.getByRole("button", { name: "열기" }));
      expect(screen.getByRole("button", { name: "안쪽 버튼" })).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "열기" })).toHaveFocus();
    });
  });
});
