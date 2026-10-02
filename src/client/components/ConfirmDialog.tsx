import { useId, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  isOpen: boolean;
  /** 확인 문구 (예: "정말 삭제하시겠습니까?") */
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  /** true면 확인 버튼을 위험 스타일로 렌더링한다 (삭제 등) */
  danger?: boolean;
};

export const ConfirmDialog = ({ isOpen, title, onConfirm, onCancel, danger = false }: ConfirmDialogProps) => {
  const titleId = useId();
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    if (isPending) {
      return;
    }

    setIsPending(true);
    try {
      await onConfirm();
    } catch {
      // 실패 표시는 호출부(TicketModal)의 책임이다. 여기서는 예외가 번지지 않게 하고 버튼만 되살린다.
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} role="alertdialog" ariaLabelledBy={titleId}>
      <h2 id={titleId} className="modal-title">
        {title}
      </h2>
      {/* 취소가 DOM에서 먼저 나와야 열릴 때 취소 버튼에 기본 포커스가 간다 (실수로 확인을 누르는 것 방지) */}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button variant={danger ? "danger" : "primary"} isLoading={isPending} onClick={handleConfirm}>
          확인
        </Button>
      </div>
    </Modal>
  );
};
