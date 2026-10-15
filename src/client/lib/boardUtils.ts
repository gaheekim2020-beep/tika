import {
  COLUMN_ORDER,
  TICKET_STATUS,
  type BoardData,
  type ReorderableStatus,
  type TicketStatus,
  type TicketWithMeta,
} from "@/shared/types";

const POSITION_GAP = 1024;
const COLUMN_DROP_PREFIX = "column:";

type DragId = string | number;

export type DropTarget = { kind: "reorder"; status: ReorderableStatus; position: number } | { kind: "complete" };

/** 칼럼 영역의 droppable id. 카드 id(숫자)와 겹치지 않도록 접두사를 붙인다 */
export const columnDropId = (status: TicketStatus) => `${COLUMN_DROP_PREFIX}${status}`;

const parseColumnDropId = (id: DragId): TicketStatus | null => {
  if (typeof id !== "string" || !id.startsWith(COLUMN_DROP_PREFIX)) return null;
  const status = id.slice(COLUMN_DROP_PREFIX.length);
  return COLUMN_ORDER.find((candidate) => candidate === status) ?? null;
};

/** 앞뒤 카드의 position으로 새 position을 계산한다 (API_SPEC §7). 없는 쪽은 null */
export const calculatePosition = (prev: number | null, next: number | null): number => {
  if (prev === null && next === null) return POSITION_GAP;
  if (prev === null) return (next as number) - POSITION_GAP;
  if (next === null) return prev + POSITION_GAP;
  return Math.ceil((prev + next) / 2);
};

export const findTicket = (board: BoardData, ticketId: number): TicketWithMeta | undefined =>
  COLUMN_ORDER.flatMap((status) => board[status]).find((ticket) => ticket.id === ticketId);

/** 드롭 대상(칼럼 영역 또는 카드)이 속한 칼럼. 대상이 없거나 알 수 없으면 null (드래그 중 칼럼 강조용) */
export const getDropStatus = (board: BoardData, overId: DragId | null): TicketStatus | null => {
  if (overId === null) return null;
  const column = parseColumnDropId(overId);
  if (column) return column;
  return typeof overId === "number" ? (findTicket(board, overId)?.status ?? null) : null;
};

const withoutTicket = (board: BoardData, ticketId: number): BoardData =>
  COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = board[status].filter((ticket) => ticket.id !== ticketId);
    return acc;
  }, {} as BoardData);

/**
 * 드롭 결과를 서버 호출로 바꾼다.
 * - 카드 위에 드롭: 같은 칼럼이면 이동 방향대로(위로 이동하면 앞, 아래로 이동하면 뒤),
 *   다른 칼럼이면 `placeAfter`가 true일 때 그 카드 뒤, 아니면 앞
 *   (`placeAfter`: 드래그 중인 카드가 대상 카드의 아래쪽에 놓였는지. 칼럼이 가득 차 빈 영역이 없을 때 맨 뒤로 보내는 방법)
 * - 칼럼 영역에 드롭: 맨 뒤
 * - 대상이 DONE이면 complete, DONE 안의 이동·제자리·대상 없음은 null (D8)
 */
export const resolveDropTarget = (
  board: BoardData,
  activeId: number,
  overId: DragId | null,
  { placeAfter = false }: { placeAfter?: boolean } = {}
): DropTarget | null => {
  if (overId === null) return null;

  const active = findTicket(board, activeId);
  if (!active) return null;

  const overColumn = parseColumnDropId(overId);
  const overTicket = overColumn === null && typeof overId === "number" ? findTicket(board, overId) : undefined;
  const targetStatus = overColumn ?? overTicket?.status;
  if (!targetStatus) return null;

  if (targetStatus === TICKET_STATUS.DONE) {
    return active.status === TICKET_STATUS.DONE ? null : { kind: "complete" };
  }

  // 같은 칼럼이면 이동 카드 자신을 이웃 계산에서 제외한다
  const original = board[targetStatus];
  const others = original.filter((ticket) => ticket.id !== activeId);

  if (overTicket) {
    if (overTicket.id === activeId) return null;

    const fromIndex = original.findIndex((ticket) => ticket.id === activeId);
    const overIndex = original.findIndex((ticket) => ticket.id === overTicket.id);
    const isSameColumn = active.status === targetStatus;
    const isAfter = isSameColumn ? fromIndex < overIndex : placeAfter;
    const overIndexInOthers = others.findIndex((ticket) => ticket.id === overTicket.id);
    const insertIndex = isAfter ? overIndexInOthers + 1 : overIndexInOthers;

    return {
      kind: "reorder",
      status: targetStatus,
      position: calculatePosition(others[insertIndex - 1]?.position ?? null, others[insertIndex]?.position ?? null),
    };
  }

  // 칼럼 영역: 이미 맨 뒤에 있는 카드를 같은 칼럼에 다시 놓으면 바뀌는 것이 없다
  if (active.status === targetStatus && original[original.length - 1]?.id === activeId) return null;

  return {
    kind: "reorder",
    status: targetStatus,
    position: calculatePosition(others[others.length - 1]?.position ?? null, null),
  };
};

/**
 * 티켓을 대상 칼럼의 position 자리로 옮긴 새 보드를 반환한다 (낙관적 반영용).
 * position이 이웃과 같으면 옮긴 카드가 그 이웃 바로 앞에 온다 (서버 충돌 규칙, API_SPEC §7)
 */
export const moveTicket = (board: BoardData, ticketId: number, status: TicketStatus, position: number): BoardData => {
  const ticket = findTicket(board, ticketId);
  if (!ticket) return board;

  const rest = withoutTicket(board, ticketId);
  const moved: TicketWithMeta = { ...ticket, status, position };
  const isOverdue = moved.status !== TICKET_STATUS.DONE && ticket.isOverdue;

  return { ...rest, [status]: [{ ...moved, isOverdue }, ...rest[status]].sort((a, b) => a.position - b.position) };
};

/** 티켓을 DONE 맨 위로 옮기고 completedAt을 채운 새 보드를 반환한다 (낙관적 반영용) */
export const completeInBoard = (board: BoardData, ticketId: number, now: Date = new Date()): BoardData => {
  const ticket = findTicket(board, ticketId);
  if (!ticket || ticket.status === TICKET_STATUS.DONE) return board;

  const rest = withoutTicket(board, ticketId);
  const firstDone = rest.DONE[0];
  const completed: TicketWithMeta = {
    ...ticket,
    status: TICKET_STATUS.DONE,
    position: firstDone ? firstDone.position - POSITION_GAP : POSITION_GAP,
    completedAt: now,
    isOverdue: false,
  };

  return { ...rest, DONE: [completed, ...rest.DONE] };
};

/** 새로 만든 티켓을 BACKLOG 맨 위에 추가한다 */
export const insertTicket = (board: BoardData, ticket: TicketWithMeta): BoardData => ({
  ...board,
  BACKLOG: [ticket, ...board.BACKLOG],
});

/** 같은 id의 카드만 교체한다 (칼럼 내 순서 유지) */
export const replaceTicket = (board: BoardData, ticket: TicketWithMeta): BoardData => {
  if (!findTicket(board, ticket.id)) return board;

  return COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = board[status].map((current) => (current.id === ticket.id ? ticket : current));
    return acc;
  }, {} as BoardData);
};

export const removeTicket = (board: BoardData, ticketId: number): BoardData =>
  findTicket(board, ticketId) ? withoutTicket(board, ticketId) : board;
