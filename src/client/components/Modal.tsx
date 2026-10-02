import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  /** 오버레이 바깥 클릭 또는 Esc 입력 시 호출 */
  onClose: () => void;
  children: ReactNode;
  /** 확인 대화상자는 "alertdialog"를 쓴다 (기본 "dialog") */
  role?: "dialog" | "alertdialog";
  /** 접근 가능한 이름. 화면에 제목이 있으면 ariaLabelledBy를 쓴다 */
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

// 열려 있는 모달의 쌓임 순서 (나중에 열린 모달이 맨 위). Esc는 맨 위 모달만 닫는다.
const openModalStack: symbol[] = [];

// body 스크롤 잠금은 모달이 여러 개 겹쳐도 한 번만 걸고, 모두 닫혔을 때 원래 값으로 되돌린다.
let scrollLockCount = 0;
let overflowBeforeLock = "";

const lockBodyScroll = (): (() => void) => {
  if (scrollLockCount === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;

  return () => {
    scrollLockCount -= 1;
    if (scrollLockCount === 0) {
      document.body.style.overflow = overflowBeforeLock;
    }
  };
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// 오버레이는 position: fixed로 화면 전체를 덮는다. 포털을 쓰지 않아 프리뷰 갤러리에서
// 패널 안에 가둘 수 있다(app/preview/_components/PreviewSection.tsx의 contained).
export const Modal = ({
  isOpen,
  onClose,
  children,
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mouseDownInsideRef = useRef(false);

  // 부모가 렌더링마다 새 함수를 넘겨도 열림 효과를 다시 실행하지 않도록 최신 함수만 보관한다
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const id = Symbol("modal");
    openModalStack.push(id);
    const unlockScroll = lockBodyScroll();
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 첫 포커스 가능 요소로 이동하고, 없으면 모달 자체가 포커스를 받는다
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openModalStack[openModalStack.length - 1] === id) {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      openModalStack.splice(openModalStack.indexOf(id), 1);
      unlockScroll();
      // 열기 전에 포커스가 있던 요소(예: "새 업무" 버튼)로 포커스를 돌려준다
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        mouseDownInsideRef.current = event.target !== event.currentTarget;
      }}
      onClick={(event) => {
        // 모달 안에서 눌러 바깥으로 끌어다 놓는 동작(텍스트 선택 등)은 닫지 않는다
        if (event.target === event.currentTarget && !mouseDownInsideRef.current) {
          onClose();
        }
        mouseDownInsideRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className="modal"
      >
        {children}
      </div>
    </div>
  );
};
