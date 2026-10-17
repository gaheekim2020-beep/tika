"use client";

import { useState } from "react";
import { useTicket } from "@/client/hooks/useTicket";
import { useTickets } from "@/client/hooks/useTickets";
import { Board } from "./Board";
import { BoardHeader } from "./BoardHeader";
import { BoardSkeleton } from "./BoardSkeleton";
import { ErrorBanner } from "./ErrorBanner";
import { TicketFormModal } from "./TicketFormModal";
import { TicketModal } from "./TicketModal";

/**
 * 최상위 상태 컨테이너 (COMPONENT_SPEC §3.2, §10).
 * 데이터와 CRUD·낙관적 이동은 useTickets가 맡고, 이 컴포넌트는 모달 열림 상태와 선택된 ticketId 같은
 * UI 상태만 소유한다. dnd-kit은 Board가 소유하며 여기서는 reorder/complete를 콜백으로 연결하기만 한다.
 */
export const BoardContainer = () => {
  const { board, isLoading, error, create, update, remove, reorder, complete, refetch } = useTickets();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const { ticket, isLoading: isTicketLoading, error: ticketError } = useTicket(selectedTicketId);

  // 첫 조회가 한 번이라도 성공했는지. 그 뒤 create/update/remove 실패로 useTickets.error가 채워져도
  // 보드를 에러 화면으로 바꾸지 않는다 (그 실패는 각 모달이 자기 안에서 표시한다, §3.2).
  // 렌더링 중에 상태를 맞추는 React의 "파생 상태 갱신" 패턴이다.
  const [hasLoaded, setHasLoaded] = useState(false);
  if (!hasLoaded && !isLoading && error === null) setHasLoaded(true);

  const renderContent = () => {
    if (isLoading) return <BoardSkeleton />;

    if (!hasLoaded && error !== null) {
      return (
        <div className="p-4 md:p-6">
          <ErrorBanner message={error} onRetry={() => void refetch()} />
        </div>
      );
    }

    return (
      <Board
        board={board}
        onTicketClick={(clicked) => setSelectedTicketId(clicked.id)}
        onReorder={reorder}
        onComplete={complete}
      />
    );
  };

  return (
    <>
      <BoardHeader onNewTicketClick={() => setIsCreateOpen(true)} />
      <main className="flex-1">{renderContent()}</main>
      <TicketFormModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSubmit={create} />
      <TicketModal
        isOpen={selectedTicketId !== null}
        ticket={ticket}
        isLoading={isTicketLoading}
        error={ticketError}
        onClose={() => setSelectedTicketId(null)}
        onSubmit={update}
        onDelete={remove}
      />
    </>
  );
};
