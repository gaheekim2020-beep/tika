import { useEffect, useState } from "react";
import { fetchTicket } from "@/client/api/ticketApi";
import { readError } from "@/client/lib/readError";
import type { TicketWithMeta } from "@/shared/types";

const FALLBACK_MESSAGE = "티켓을 불러오지 못했습니다";

export interface UseTicketReturn {
  ticket: TicketWithMeta | null;
  isLoading: boolean;
  error: string | null;
}

type FetchResult = { ticket: TicketWithMeta | null; error: string | null };

/**
 * 상세 모달이 열릴 때 티켓 한 건을 조회한다 (COMPONENT_SPEC §3.5).
 * - ticketId가 null이면 조회하지 않는다 (모달이 닫힘)
 * - ticketId가 바뀌면 결과를 비우고 다시 조회한다. 옛 티켓이 남아 있으면 TicketForm이 옛 값으로 초기화되기 때문이다
 * - 이전 요청의 응답이 늦게 도착해도 새 요청의 결과를 덮어쓰지 않는다
 */
export const useTicket = (ticketId: number | null): UseTicketReturn => {
  const [result, setResult] = useState<FetchResult | null>(null);
  const [trackedId, setTrackedId] = useState(ticketId);

  // id가 바뀌는 렌더링에서 바로 결과를 비운다 (React의 "prop이 바뀔 때 상태 초기화" 패턴).
  // 같은 id로 닫았다가 다시 열어도 id가 null을 거쳐 오므로 이전 결과가 남지 않는다.
  if (trackedId !== ticketId) {
    setTrackedId(ticketId);
    setResult(null);
  }

  useEffect(() => {
    if (ticketId === null) return;

    // 정리 함수가 실행되면(id 변경, null로 복귀, 언마운트) 이 요청의 응답은 버린다
    let isCancelled = false;

    fetchTicket(ticketId).then(
      (ticket) => {
        if (!isCancelled) setResult({ ticket, error: null });
      },
      (caught: unknown) => {
        if (!isCancelled) setResult({ ticket: null, error: readError(caught, FALLBACK_MESSAGE).message });
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [ticketId]);

  return {
    ticket: result?.ticket ?? null,
    isLoading: ticketId !== null && result === null,
    error: result?.error ?? null,
  };
};
