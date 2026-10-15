import { useId, useState } from "react";
import type { TicketWithMeta, UpdateTicketInput } from "@/shared/types";
import { getChangedFields } from "@/client/lib/getChangedFields";
import { readError } from "@/client/lib/readError";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeleteButton } from "./DeleteButton";
import { ErrorToast } from "./ErrorToast";
import { Modal } from "./Modal";
import { TicketDetailView } from "./TicketDetailView";
import { TicketForm } from "./TicketForm";

type TicketModalProps = {
  isOpen: boolean;
  /** 조회된 티켓. 조회 중이거나 실패하면 null (조회는 BoardContainer가 useTicket으로 한다) */
  ticket: TicketWithMeta | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (id: number, input: UpdateTicketInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

const FALLBACK_MESSAGE = "요청을 처리하지 못했습니다";

export const TicketModal = ({ isOpen, ticket, isLoading, error, onClose, onSubmit, onDelete }: TicketModalProps) => {
  const titleId = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleClose = () => {
    setFieldErrors({});
    setToastMessage(null);
    setIsConfirmOpen(false);
    onClose();
  };

  // 변경된 필드만 PATCH한다. 바뀐 게 없으면 폼이 저장 자체를 막는다.
  const handleSubmit = async (target: TicketWithMeta, input: UpdateTicketInput) => {
    setFieldErrors({});
    setToastMessage(null);

    try {
      await onSubmit(target.id, getChangedFields(target, input));
    } catch (submitError) {
      const { message, field } = readError(submitError, FALLBACK_MESSAGE);
      if (field) {
        setFieldErrors({ [field]: message });
      } else {
        setToastMessage(message);
      }
      return;
    }

    handleClose();
  };

  // 실패하면 확인 다이얼로그와 상세 모달을 모두 유지하고 토스트를 띄운다 (TC-COMP-008-06)
  const handleDelete = async (target: TicketWithMeta) => {
    setToastMessage(null);

    try {
      await onDelete(target.id);
    } catch (deleteError) {
      setToastMessage(readError(deleteError, FALLBACK_MESSAGE).message);
      return;
    }

    handleClose();
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div role="status" aria-busy="true" aria-label="상세 정보를 불러오는 중" className="flex flex-col gap-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-9" />
          <div className="skeleton h-9" />
          <div className="skeleton h-9" />
        </div>
      );
    }

    if (error || !ticket) {
      // 수정·삭제할 데이터가 없으므로 폼과 삭제 버튼은 렌더링하지 않는다
      return <p role="alert" className="form-error">{error ?? FALLBACK_MESSAGE}</p>;
    }

    return (
      <>
        <TicketDetailView ticket={ticket} />
        <TicketForm
          ticket={ticket}
          onSubmit={(input) => handleSubmit(ticket, input)}
          onCancel={handleClose}
          errors={fieldErrors}
        />
        <div className="delete-zone">
          <DeleteButton onClick={() => setIsConfirmOpen(true)} />
        </div>
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title="정말 삭제하시겠습니까?"
          danger
          onConfirm={() => handleDelete(ticket)}
          onCancel={() => setIsConfirmOpen(false)}
        />
      </>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} ariaLabelledBy={titleId}>
        <h2 id={titleId} className="modal-title">
          업무 상세
        </h2>
        {renderBody()}
      </Modal>
      {isOpen && toastMessage && <ErrorToast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </>
  );
};
