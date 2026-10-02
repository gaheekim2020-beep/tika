import { COLUMN_ORDER } from "@/shared/types";
import {
  longTitleTicket,
  makeBoard,
  makeBoardOf,
  makeEmptyBoard,
  makeTicket,
} from "./fixtures";

describe("테스트 fixture", () => {
  it("미리보기 목 데이터의 함수를 그대로 다시 내보낸다 (중복 정의 방지)", () => {
    expect(makeTicket({ id: 5 }).id).toBe(5);
    expect(Object.keys(makeBoard()).sort()).toEqual([...COLUMN_ORDER].sort());
    expect(Object.values(makeEmptyBoard()).every((tickets) => tickets.length === 0)).toBe(true);
    expect(longTitleTicket.title).toHaveLength(200);
  });

  describe("makeBoardOf", () => {
    it("티켓을 status별로 나누고 칼럼 안에서 position 오름차순으로 정렬한다", () => {
      const board = makeBoardOf([
        makeTicket({ id: 1, status: "TODO", position: 3072 }),
        makeTicket({ id: 2, status: "TODO", position: 1024 }),
        makeTicket({ id: 3, status: "DONE", position: 1024 }),
        makeTicket({ id: 4, status: "TODO", position: 2048 }),
      ]);

      expect(board.TODO.map((ticket) => ticket.id)).toEqual([2, 4, 1]);
      expect(board.DONE.map((ticket) => ticket.id)).toEqual([3]);
    });

    it("티켓이 없는 칼럼도 빈 배열로 4개 키를 모두 가진다", () => {
      const board = makeBoardOf([makeTicket({ id: 1, status: "BACKLOG" })]);

      expect(Object.keys(board).sort()).toEqual([...COLUMN_ORDER].sort());
      expect(board.TODO).toEqual([]);
      expect(board.IN_PROGRESS).toEqual([]);
      expect(board.DONE).toEqual([]);
    });

    it("입력 배열을 변경하지 않는다", () => {
      const input = [
        makeTicket({ id: 1, status: "TODO", position: 2048 }),
        makeTicket({ id: 2, status: "TODO", position: 1024 }),
      ];
      const before = input.map((ticket) => ticket.id);

      makeBoardOf(input);

      expect(input.map((ticket) => ticket.id)).toEqual(before);
    });
  });
});
