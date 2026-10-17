import { NewTicketButton } from "./NewTicketButton";
import { SearchInput } from "./SearchInput";

type BoardHeaderProps = {
  /** "새 업무" 클릭 시 생성 모달을 연다 */
  onNewTicketClick: () => void;
};

export const BoardHeader = ({ onNewTicketClick }: BoardHeaderProps) => (
  <header className="topbar">
    <div className="flex min-w-0 items-center gap-4">
      <span className="logo">
        <span className="logo-mark" aria-hidden="true">
          T
        </span>
        Tika
      </span>
      <SearchInput />
    </div>
    <div className="topbar-actions">
      <NewTicketButton onClick={onNewTicketClick} />
    </div>
  </header>
);
