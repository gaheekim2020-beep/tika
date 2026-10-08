import { useId, useState } from "react";
import type { CreateTicketInput } from "@/shared/types";
import { readError } from "@/client/lib/readError";
import { ErrorToast } from "./ErrorToast";
import { Modal } from "./Modal";
import { TicketForm } from "./TicketForm";

type TicketFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTicketInput) => Promise<void>;
};

const FALLBACK_MESSAGE = "티켓을 저장하지 못했습니다";

export const TicketFormModal = ({ isOpen, onClose, onSubmit }: TicketFormModalProps) => {
  const titleId = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleClose = () => {
    setFieldErrors({});
    setToastMessage(null);
    onClose();
  };

  // 필드가 있는 오류는 해당 입력창 아래에, 그 외는 토스트로 보여 주고 모달은 유지한다 (D3)
  const handleSubmit = async (input: CreateTicketInput) => {
    setFieldErrors({});
    setToastMessage(null);

    try {
      await onSubmit(input);
    } catch (error) {
      const { message, field } = readError(error, FALLBACK_MESSAGE);
      if (field) {
        setFieldErrors({ [field]: message });
      } else {
        setToastMessage(message);
      }
      return;
    }

    handleClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} ariaLabelledBy={titleId}>
        <h2 id={titleId} className="modal-title">
          새 업무 만들기
        </h2>
        <TicketForm onSubmit={handleSubmit} onCancel={handleClose} errors={fieldErrors} />
      </Modal>
      {isOpen && toastMessage && <ErrorToast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </>
  );
};
