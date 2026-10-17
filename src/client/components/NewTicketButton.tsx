import { Button } from "./Button";

type NewTicketButtonProps = {
  /** 클릭 시 생성 모달(TicketFormModal)을 연다 */
  onClick: () => void;
};

// 화면 텍스트("새 업무")와 접근 가능한 이름("새 티켓 생성")이 다르다 (COMPONENT_SPEC §3.3)
export const NewTicketButton = ({ onClick }: NewTicketButtonProps) => (
  <Button variant="primary" aria-label="새 티켓 생성" onClick={onClick}>
    새 업무
  </Button>
);
