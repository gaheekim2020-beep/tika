import { COLUMN_ORDER, type BoardData, type TicketWithMeta } from "@/shared/types";

/*
 * 테스트 fixture — 미리보기 갤러리의 목 데이터를 그대로 다시 내보내 중복 정의를 피한다.
 * 값이 고정(시각·카운터 미사용)이라 테스트가 호출 순서나 시간에 영향받지 않는다.
 */
export {
  longTitleTicket,
  makeBoard,
  makeEmptyBoard,
  makeTicket,
} from "@/app/preview/_mock/mockData";

/** 티켓 목록을 status별로 나누고 칼럼 안에서 position 오름차순으로 정렬한 보드를 만든다 */
export const makeBoardOf = (tickets: TicketWithMeta[]): BoardData => {
  const board = COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = [];
    return acc;
  }, {} as BoardData);

  tickets.forEach((ticket) => board[ticket.status].push(ticket));
  COLUMN_ORDER.forEach((status) => board[status].sort((a, b) => a.position - b.position));

  return board;
};
