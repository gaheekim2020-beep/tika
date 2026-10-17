import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeTicket,
  createTicket,
  deleteTicket,
  fetchBoard,
  reorderTicket,
  updateTicket,
} from "@/client/api/ticketApi";
import {
  completeInBoard,
  findTicket,
  insertTicket,
  moveTicket,
  removeTicket,
  replaceTicket,
} from "@/client/lib/boardUtils";
import { readError } from "@/client/lib/readError";
import {
  COLUMN_ORDER,
  type BoardData,
  type CreateTicketInput,
  type ReorderableStatus,
  type TicketWithMeta,
  type UpdateTicketInput,
} from "@/shared/types";

const FALLBACK_MESSAGE = "요청을 처리하지 못했습니다";

export interface UseTicketsReturn {
  board: BoardData;
  isLoading: boolean;
  error: string | null;
  create: (data: CreateTicketInput) => Promise<void>;
  update: (id: number, data: UpdateTicketInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reorder: (ticketId: number, status: ReorderableStatus, position: number) => Promise<void>;
  complete: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

const createEmptyBoard = (): BoardData =>
  COLUMN_ORDER.reduce((board, status) => {
    board[status] = [];
    return board;
  }, {} as BoardData);

// 이동 전 상태(칼럼·위치·나머지 필드)로 카드 한 장만 되돌린다. 그 사이 다른 카드에 일어난 변경은 건드리지 않는다.
const restoreTicket = (board: BoardData, original: TicketWithMeta): BoardData =>
  replaceTicket(moveTicket(board, original.id, original.status, original.position), original);

/**
 * 보드 상태와 티켓 CRUD·이동을 관리한다 (COMPONENT_SPEC §3.5, §7).
 * - create/update/remove: 서버 응답을 받은 뒤 반영하고, 실패하면 ApiError로 reject한다 (모달이 실패를 알아야 하므로)
 * - reorder/complete: 먼저 화면에 반영하고(낙관적 업데이트), 실패하면 그 카드만 조용히 되돌린다
 */
export const useTickets = (initialData?: BoardData): UseTicketsReturn => {
  const [board, setBoard] = useState<BoardData>(() => initialData ?? createEmptyBoard());
  const [isLoading, setIsLoading] = useState(initialData === undefined);
  const [error, setError] = useState<string | null>(null);

  // 비동기 응답이 도착했을 때 클로저가 붙잡은 옛 board가 아니라 항상 최신 board를 읽기 위한 값
  const boardRef = useRef(board);
  // 응답을 기다리는 이동(reorder/complete) 수. 0일 때만 서버 보드로 통째로 확정한다 (다른 이동의 화면 반영을 지우지 않으려고)
  const pendingMovesRef = useRef(0);
  const latestFetchRef = useRef(0);
  const isMountedRef = useRef(false);
  const hasInitialDataRef = useRef(initialData !== undefined);

  const commitBoard = useCallback((next: BoardData) => {
    boardRef.current = next;
    if (isMountedRef.current) setBoard(next);
  }, []);

  const refetch = useCallback(async () => {
    const fetchId = ++latestFetchRef.current;
    // 더 최근의 refetch가 있거나 언마운트되었으면 이 응답은 버린다
    const isStale = () => !isMountedRef.current || fetchId !== latestFetchRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const next = await fetchBoard();
      if (isStale()) return;
      commitBoard(next);
    } catch (caught) {
      if (isStale()) return;
      setError(readError(caught, FALLBACK_MESSAGE).message);
    }

    setIsLoading(false);
  }, [commitBoard]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!hasInitialDataRef.current) void refetch();

    return () => {
      isMountedRef.current = false;
    };
  }, [refetch]);

  // 필드 오류(error.field가 있는 400)는 폼이 입력창 아래에 표시하므로 error 상태를 채우지 않는다
  const reportFailure = useCallback((caught: unknown) => {
    const { message, field } = readError(caught, FALLBACK_MESSAGE);
    if (!field && isMountedRef.current) setError(message);
  }, []);

  const mutate = useCallback(
    async <T>(call: () => Promise<T>, apply: (current: BoardData, result: T) => BoardData): Promise<void> => {
      try {
        const result = await call();
        commitBoard(apply(boardRef.current, result));
      } catch (caught) {
        reportFailure(caught);
        throw caught;
      }
    },
    [commitBoard, reportFailure]
  );

  const create = useCallback(
    (data: CreateTicketInput) => mutate(() => createTicket(data), (current, ticket) => insertTicket(current, ticket)),
    [mutate]
  );

  const update = useCallback(
    (id: number, data: UpdateTicketInput) =>
      mutate(() => updateTicket(id, data), (current, ticket) => replaceTicket(current, ticket)),
    [mutate]
  );

  const remove = useCallback(
    (id: number) => mutate(() => deleteTicket(id), (current) => removeTicket(current, id)),
    [mutate]
  );

  const reorder = useCallback(
    async (ticketId: number, status: ReorderableStatus, position: number) => {
      const original = findTicket(boardRef.current, ticketId);
      if (!original) return;

      pendingMovesRef.current += 1;
      commitBoard(moveTicket(boardRef.current, ticketId, status, position));

      let serverBoard: BoardData | null = null;
      try {
        serverBoard = await reorderTicket({ ticketId, status, position });
      } catch {
        // 실패하면 아래에서 조용히 되돌린다 (error를 채우거나 reject하지 않음, §7)
      }
      pendingMovesRef.current -= 1;

      if (serverBoard === null) {
        commitBoard(restoreTicket(boardRef.current, original));
      } else if (pendingMovesRef.current === 0) {
        commitBoard(serverBoard);
      }
    },
    [commitBoard]
  );

  const complete = useCallback(
    async (id: number) => {
      const original = findTicket(boardRef.current, id);
      if (!original) return;

      pendingMovesRef.current += 1;
      commitBoard(completeInBoard(boardRef.current, id));

      try {
        const serverTicket = await completeTicket(id);
        // 서버가 정한 칼럼·위치·completedAt으로 이 카드만 확정한다
        commitBoard(
          replaceTicket(moveTicket(boardRef.current, id, serverTicket.status, serverTicket.position), serverTicket)
        );
      } catch {
        commitBoard(restoreTicket(boardRef.current, original));
      } finally {
        pendingMovesRef.current -= 1;
      }
    },
    [commitBoard]
  );

  const clearError = useCallback(() => setError(null), []);

  return { board, isLoading, error, create, update, remove, reorder, complete, refetch, clearError };
};
