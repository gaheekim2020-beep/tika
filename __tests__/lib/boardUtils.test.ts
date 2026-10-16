import {
  calculatePosition,
  columnDropId,
  completeInBoard,
  findTicket,
  getDropStatus,
  insertTicket,
  moveTicket,
  removeTicket,
  replaceTicket,
  resolveDropTarget,
} from "@/client/lib/boardUtils";
import { makeBoardOf, makeTicket } from "../helpers/fixtures";

// TEST_CASES §3.15 예시 보드: BACKLOG [X=1024], TODO [A=1024, B=2048, C=3072], IN_PROGRESS [], DONE [D=1024]
const X = 10;
const A = 11;
const B = 12;
const C = 13;
const D = 14;

const makeSampleBoard = () =>
  makeBoardOf([
    makeTicket({ id: X, title: "X", status: "BACKLOG", position: 1024 }),
    makeTicket({ id: A, title: "A", status: "TODO", position: 1024 }),
    makeTicket({ id: B, title: "B", status: "TODO", position: 2048 }),
    makeTicket({ id: C, title: "C", status: "TODO", position: 3072 }),
    makeTicket({ id: D, title: "D", status: "DONE", position: 1024, completedAt: new Date("2026-10-01T00:00:00.000Z") }),
  ]);

const idsOf = (tickets: { id: number }[]) => tickets.map((ticket) => ticket.id);

describe("calculatePosition (API_SPEC §7)", () => {
  // TC-CLIENT-UTIL-001-01
  it("두 카드 사이는 올림한 중간값이다", () => {
    expect(calculatePosition(1024, 2048)).toBe(1536);
  });

  // TC-CLIENT-UTIL-001-02
  it("정수 간격이 없으면 올림 결과가 next와 같아진다", () => {
    expect(calculatePosition(1024, 1025)).toBe(1025);
  });

  // TC-CLIENT-UTIL-001-03
  it("맨 앞이면 첫 카드 - 1024이다", () => {
    expect(calculatePosition(null, 1024)).toBe(0);
  });

  // TC-CLIENT-UTIL-001-04
  it("맨 뒤이면 마지막 카드 + 1024이다", () => {
    expect(calculatePosition(2048, null)).toBe(3072);
  });

  // TC-CLIENT-UTIL-001-05
  it("빈 칼럼이면 1024이다", () => {
    expect(calculatePosition(null, null)).toBe(1024);
  });
});

describe("resolveDropTarget (§3.4, D8)", () => {
  // TC-CLIENT-UTIL-001-06
  it("다른 칼럼의 카드 위에 드롭하면 그 카드 앞 자리(A와 B 사이)에 놓인다", () => {
    expect(resolveDropTarget(makeSampleBoard(), X, B)).toEqual({ kind: "reorder", status: "TODO", position: 1536 });
  });

  // 다른 칼럼의 마지막 카드 아래쪽에 놓으면 그 카드 뒤에 놓인다 (칼럼이 가득 차 빈 영역이 없을 때 맨 뒤로 보내는 방법)
  // TC-CLIENT-UTIL-001-27
  it("다른 칼럼의 카드 위에서 아래쪽(placeAfter)에 놓으면 그 카드 뒤에 놓인다", () => {
    const board = makeSampleBoard();

    expect(resolveDropTarget(board, X, C, { placeAfter: true })).toEqual({ kind: "reorder", status: "TODO", position: 4096 });
    expect(resolveDropTarget(board, X, B, { placeAfter: true })).toEqual({ kind: "reorder", status: "TODO", position: 2560 });
  });

  it("다른 칼럼의 카드 위에서 위쪽(placeAfter=false)에 놓으면 그 카드 앞에 놓인다", () => {
    const board = makeSampleBoard();

    expect(resolveDropTarget(board, X, C, { placeAfter: false })).toEqual({ kind: "reorder", status: "TODO", position: 2560 });
    expect(resolveDropTarget(board, X, A, { placeAfter: false })).toEqual({ kind: "reorder", status: "TODO", position: 0 });
  });

  // TC-CLIENT-UTIL-001-28
  it("같은 칼럼 안의 이동은 placeAfter와 상관없이 이동 방향으로 앞/뒤를 정한다", () => {
    const board = makeSampleBoard();

    expect(resolveDropTarget(board, A, B, { placeAfter: false })).toEqual({ kind: "reorder", status: "TODO", position: 2560 });
    expect(resolveDropTarget(board, C, B, { placeAfter: true })).toEqual({ kind: "reorder", status: "TODO", position: 1536 });
  });

  // TC-CLIENT-UTIL-001-07
  it("칼럼의 빈 영역에 드롭하면 맨 뒤에 놓인다", () => {
    expect(resolveDropTarget(makeSampleBoard(), X, columnDropId("TODO"))).toEqual({
      kind: "reorder",
      status: "TODO",
      position: 4096,
    });
  });

  // TC-CLIENT-UTIL-001-08
  it("카드가 없는 칼럼에 드롭하면 position은 1024이다", () => {
    expect(resolveDropTarget(makeSampleBoard(), X, columnDropId("IN_PROGRESS"))).toEqual({
      kind: "reorder",
      status: "IN_PROGRESS",
      position: 1024,
    });
  });

  // TC-CLIENT-UTIL-001-09
  it("같은 칼럼에서 위로 이동하면 대상 카드 앞에 놓인다 (자기 자신은 이웃에서 제외)", () => {
    expect(resolveDropTarget(makeSampleBoard(), C, B)).toEqual({ kind: "reorder", status: "TODO", position: 1536 });
  });

  // TC-CLIENT-UTIL-001-10
  it("같은 칼럼에서 아래로 이동하면 대상 카드 뒤에 놓인다", () => {
    expect(resolveDropTarget(makeSampleBoard(), A, B)).toEqual({ kind: "reorder", status: "TODO", position: 2560 });
  });

  // TC-CLIENT-UTIL-001-11
  it("같은 칼럼 맨 앞으로 이동하면 첫 카드 - 1024이다", () => {
    expect(resolveDropTarget(makeSampleBoard(), C, A)).toEqual({ kind: "reorder", status: "TODO", position: 0 });
  });

  // TC-CLIENT-UTIL-001-12
  it.each([
    ["DONE 칼럼 영역", columnDropId("DONE")],
    ["DONE의 카드 위", D],
  ])("다른 칼럼에서 %s로 드롭하면 complete이다", (_label, overId) => {
    expect(resolveDropTarget(makeSampleBoard(), B, overId)).toEqual({ kind: "complete" });
  });

  // TC-CLIENT-UTIL-001-13
  it("DONE에서 다른 칼럼으로 나가는 것은 허용한다", () => {
    expect(resolveDropTarget(makeSampleBoard(), D, columnDropId("TODO"))).toEqual({
      kind: "reorder",
      status: "TODO",
      position: 4096,
    });
  });

  // TC-CLIENT-UTIL-001-23
  it("제자리(자기 자신 위) 드롭은 null이다", () => {
    expect(resolveDropTarget(makeSampleBoard(), B, B)).toBeNull();
  });

  // TC-CLIENT-UTIL-001-24
  it.each([
    ["DONE 칼럼 영역", columnDropId("DONE")],
    ["자기 자신", D],
  ])("DONE 칼럼 안의 이동(%s)은 null이다", (_label, overId) => {
    expect(resolveDropTarget(makeSampleBoard(), D, overId)).toBeNull();
  });

  // TC-CLIENT-UTIL-001-25
  it("드롭 대상이 없으면 null이다", () => {
    expect(resolveDropTarget(makeSampleBoard(), B, null)).toBeNull();
  });

  it("같은 칼럼의 빈 영역에 놓았는데 이미 맨 뒤라면 null이다 (바뀌는 것이 없다)", () => {
    expect(resolveDropTarget(makeSampleBoard(), C, columnDropId("TODO"))).toBeNull();
  });

  it("같은 칼럼의 빈 영역에 놓으면 맨 뒤로 보낸다", () => {
    expect(resolveDropTarget(makeSampleBoard(), A, columnDropId("TODO"))).toEqual({
      kind: "reorder",
      status: "TODO",
      position: 4096,
    });
  });

  it("보드에 없는 카드나 알 수 없는 대상은 null이다", () => {
    expect(resolveDropTarget(makeSampleBoard(), 999, B)).toBeNull();
    expect(resolveDropTarget(makeSampleBoard(), B, 999)).toBeNull();
    expect(resolveDropTarget(makeSampleBoard(), B, "column:UNKNOWN")).toBeNull();
  });
});

describe("moveTicket (§3.6 낙관적 업데이트)", () => {
  // TC-CLIENT-UTIL-001-14
  it("원래 칼럼에서 빠지고 대상 칼럼에 position 순서로 들어가며 status/position이 반영된다", () => {
    const moved = moveTicket(makeSampleBoard(), X, "TODO", 1536);

    expect(idsOf(moved.BACKLOG)).toEqual([]);
    expect(idsOf(moved.TODO)).toEqual([A, X, B, C]);
    expect(moved.TODO[1]).toMatchObject({ status: "TODO", position: 1536 });
  });

  // TC-CLIENT-UTIL-001-15
  it("입력 보드를 바꾸지 않고 새 객체를 반환한다", () => {
    const board = makeSampleBoard();
    const snapshot = JSON.stringify(board);

    const moved = moveTicket(board, X, "TODO", 1536);

    expect(moved).not.toBe(board);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("같은 칼럼 안에서 옮겨도 중복 없이 순서만 바뀐다", () => {
    const moved = moveTicket(makeSampleBoard(), C, "TODO", 1536);

    expect(idsOf(moved.TODO)).toEqual([A, C, B]);
  });

  it("position이 이웃과 같으면 옮긴 카드가 그 이웃 바로 앞에 놓인다 (서버 충돌 규칙)", () => {
    const moved = moveTicket(makeSampleBoard(), X, "TODO", 2048);

    expect(idsOf(moved.TODO)).toEqual([A, X, B, C]);
  });

  // TC-CLIENT-UTIL-001-26
  it("없는 id면 보드 내용이 그대로다", () => {
    const board = makeSampleBoard();

    expect(moveTicket(board, 999, "TODO", 1536)).toEqual(board);
  });
});

describe("completeInBoard", () => {
  const now = new Date("2026-10-15T00:00:00.000Z");

  // TC-CLIENT-UTIL-001-16
  it("DONE 맨 위(기존 최솟값 - 1024)에 놓이고 status와 completedAt이 채워진다", () => {
    const done = completeInBoard(makeSampleBoard(), B, now);

    expect(idsOf(done.TODO)).toEqual([A, C]);
    expect(idsOf(done.DONE)).toEqual([B, D]);
    expect(done.DONE[0]).toMatchObject({ status: "DONE", position: 0, completedAt: now });
  });

  it("DONE이 비어 있으면 position은 1024이다", () => {
    const board = makeBoardOf([makeTicket({ id: A, status: "TODO", position: 1024 })]);

    expect(completeInBoard(board, A, now).DONE[0]).toMatchObject({ position: 1024 });
  });

  it("완료된 카드는 지연이 아니다 (isOverdue는 status !== DONE일 때만 true)", () => {
    const board = makeBoardOf([makeTicket({ id: A, status: "TODO", dueDate: "2026-09-01", isOverdue: true })]);

    expect(completeInBoard(board, A, now).DONE[0].isOverdue).toBe(false);
  });

  it("이미 DONE인 카드는 그대로다 (complete는 멱등)", () => {
    const board = makeSampleBoard();

    expect(completeInBoard(board, D, now)).toEqual(board);
  });

  it("입력 보드를 바꾸지 않는다", () => {
    const board = makeSampleBoard();
    const snapshot = JSON.stringify(board);

    completeInBoard(board, B, now);

    expect(JSON.stringify(board)).toBe(snapshot);
  });

  // TC-CLIENT-UTIL-001-26
  it("없는 id면 보드 내용이 그대로다", () => {
    const board = makeSampleBoard();

    expect(completeInBoard(board, 999, now)).toEqual(board);
  });
});

describe("insertTicket / replaceTicket / removeTicket", () => {
  // TC-CLIENT-UTIL-001-17
  it("insertTicket은 BACKLOG 맨 위에 추가한다", () => {
    const created = makeTicket({ id: 50, title: "새 티켓", position: 0 });

    const next = insertTicket(makeSampleBoard(), created);

    expect(idsOf(next.BACKLOG)).toEqual([50, X]);
  });

  // TC-CLIENT-UTIL-001-18
  it("replaceTicket은 같은 id의 카드만 교체하고 칼럼 내 순서는 유지한다", () => {
    const updated = makeTicket({ id: B, title: "B 수정", status: "TODO", position: 2048 });

    const next = replaceTicket(makeSampleBoard(), updated);

    expect(idsOf(next.TODO)).toEqual([A, B, C]);
    expect(next.TODO[1].title).toBe("B 수정");
  });

  // TC-CLIENT-UTIL-001-19
  it("removeTicket은 해당 카드를 제거한다", () => {
    const next = removeTicket(makeSampleBoard(), B);

    expect(idsOf(next.TODO)).toEqual([A, C]);
  });

  it("세 함수 모두 입력 보드를 바꾸지 않는다", () => {
    const board = makeSampleBoard();
    const snapshot = JSON.stringify(board);

    insertTicket(board, makeTicket({ id: 50 }));
    replaceTicket(board, makeTicket({ id: B, status: "TODO", title: "다름" }));
    removeTicket(board, B);

    expect(JSON.stringify(board)).toBe(snapshot);
  });

  // TC-CLIENT-UTIL-001-26
  it("replaceTicket/removeTicket에 없는 id를 주면 보드 내용이 그대로다", () => {
    const board = makeSampleBoard();

    expect(replaceTicket(board, makeTicket({ id: 999 }))).toEqual(board);
    expect(removeTicket(board, 999)).toEqual(board);
  });
});

describe("getDropStatus / findTicket", () => {
  it("칼럼 영역이면 그 칼럼, 카드 위면 그 카드가 속한 칼럼을 돌려준다", () => {
    const board = makeSampleBoard();

    expect(getDropStatus(board, columnDropId("IN_PROGRESS"))).toBe("IN_PROGRESS");
    expect(getDropStatus(board, B)).toBe("TODO");
  });

  it("대상이 없거나 알 수 없으면 null이다", () => {
    const board = makeSampleBoard();

    expect(getDropStatus(board, null)).toBeNull();
    expect(getDropStatus(board, 999)).toBeNull();
    expect(getDropStatus(board, "column:UNKNOWN")).toBeNull();
  });

  it("findTicket은 칼럼과 상관없이 id로 티켓을 찾고, 없으면 undefined이다", () => {
    const board = makeSampleBoard();

    expect(findTicket(board, D)?.title).toBe("D");
    expect(findTicket(board, 999)).toBeUndefined();
  });
});
