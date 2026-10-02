import { COLUMN_ORDER, TICKET_STATUS } from "@/shared/types";
import {
  longTitleTicket,
  makeBoard,
  makeEmptyBoard,
  makeTicket,
} from "@/app/preview/_mock/mockData";

describe("프리뷰 목 데이터", () => {
  describe("makeTicket", () => {
    it("기본값으로 유효한 티켓을 만들고 전달한 값으로 덮어쓸 수 있다", () => {
      const base = makeTicket();
      const custom = makeTicket({ id: 9, title: "바꾼 제목", priority: "HIGH" });

      expect(base).toMatchObject({ status: TICKET_STATUS.BACKLOG, priority: "MEDIUM", isOverdue: false });
      expect(base.createdAt).toBeInstanceOf(Date);
      expect(custom).toMatchObject({ id: 9, title: "바꾼 제목", priority: "HIGH" });
    });

    it("호출할 때마다 같은 결과를 돌려준다 (서버·클라이언트 렌더링 불일치 방지)", () => {
      expect(makeTicket({ id: 3 })).toEqual(makeTicket({ id: 3 }));
    });
  });

  describe("makeBoard", () => {
    const board = makeBoard();
    const all = COLUMN_ORDER.flatMap((status) => board[status]);

    it("4개 칼럼을 모두 가지고 칼럼마다 티켓이 하나 이상 있다", () => {
      expect(Object.keys(board).sort()).toEqual([...COLUMN_ORDER].sort());
      COLUMN_ORDER.forEach((status) => expect(board[status].length).toBeGreaterThan(0));
    });

    it("티켓 id가 중복되지 않는다", () => {
      expect(new Set(all.map((ticket) => ticket.id)).size).toBe(all.length);
    });

    it("각 티켓의 status는 속한 칼럼과 같고 칼럼 안에서 position 오름차순이다", () => {
      COLUMN_ORDER.forEach((status) => {
        const positions = board[status].map((ticket) => ticket.position);
        board[status].forEach((ticket) => expect(ticket.status).toBe(status));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
      });
    });

    it("지연된 카드와 정상 카드가 모두 있고, DONE 카드는 지연으로 표시되지 않는다", () => {
      expect(all.some((ticket) => ticket.isOverdue)).toBe(true);
      expect(all.some((ticket) => !ticket.isOverdue && ticket.dueDate !== null)).toBe(true);
      board.DONE.forEach((ticket) => expect(ticket.isOverdue).toBe(false));
    });

    it("우선순위 3종이 모두 쓰이고 DONE에만 completedAt이 있다", () => {
      expect(new Set(all.map((ticket) => ticket.priority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
      board.DONE.forEach((ticket) => expect(ticket.completedAt).toBeInstanceOf(Date));
      COLUMN_ORDER.filter((status) => status !== TICKET_STATUS.DONE).forEach((status) =>
        board[status].forEach((ticket) => expect(ticket.completedAt).toBeNull())
      );
    });
  });

  describe("makeEmptyBoard / longTitleTicket", () => {
    it("빈 보드는 4개 칼럼이 모두 비어 있다", () => {
      const board = makeEmptyBoard();

      COLUMN_ORDER.forEach((status) => expect(board[status]).toEqual([]));
    });

    it("긴 제목 티켓은 제목이 200자다 (말줄임 확인용)", () => {
      expect(longTitleTicket.title).toHaveLength(200);
    });
  });
});
