import type { CollisionDetection } from "@dnd-kit/core";
import { boardCollisionDetection } from "@/client/lib/boardCollision";
import { columnDropId } from "@/client/lib/boardUtils";

type Args = Parameters<CollisionDetection>[0];

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

/*
 * 화면 배치 (좌표는 viewport 기준):
 *   BACKLOG 칼럼 x 0~90   : 카드 1 (아주 긴 카드) y 50~350
 *   TODO 칼럼    x 100~300: 카드 5 y 50~150 (중심 100), 카드 6 y 160~260 (중심 210)
 *   IN_PROGRESS 칼럼 x 310~410 : 카드 없음
 */
const layout = {
  [columnDropId("BACKLOG")]: rect(0, 0, 90, 400),
  [columnDropId("TODO")]: rect(100, 0, 200, 400),
  [columnDropId("IN_PROGRESS")]: rect(310, 0, 100, 400),
  1: rect(5, 50, 80, 300),
  5: rect(110, 50, 180, 100),
  6: rect(110, 160, 180, 100),
};

const detect = (pointer: { x: number; y: number } | null, collisionRect: ReturnType<typeof rect> | null = null) => {
  const droppableRects = new Map(Object.entries(layout).map(([id, value]) => [/^\d+$/.test(id) ? Number(id) : id, value]));
  const droppableContainers = [...droppableRects.keys()].map((id) => ({ id, disabled: false }));

  return boardCollisionDetection({
    active: { id: 1 },
    collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer,
  } as unknown as Args);
};

describe("boardCollisionDetection (카드 우선, 포인터 기준)", () => {
  // TC-CLIENT-UTIL-001-29
  it("카드의 위쪽 절반 위에서는 그 카드와 placeAfter=false를 돌려준다", () => {
    expect(detect({ x: 200, y: 70 })).toEqual([{ id: 5, data: { placeAfter: false } }]);
  });

  it("카드의 아래쪽 절반 위에서는 그 카드와 placeAfter=true를 돌려준다", () => {
    expect(detect({ x: 200, y: 140 })).toEqual([{ id: 5, data: { placeAfter: true } }]);
  });

  // TC-CLIENT-UTIL-001-30
  it("첫 카드 위의 칼럼 여백(헤더 영역)에서는 첫 카드의 앞으로 판단한다", () => {
    expect(detect({ x: 200, y: 20 })).toEqual([{ id: 5, data: { placeAfter: false } }]);
  });

  // TC-CLIENT-UTIL-001-31
  it("마지막 카드 아래의 칼럼 여백에서는 마지막 카드의 뒤로 판단한다", () => {
    expect(detect({ x: 200, y: 330 })).toEqual([{ id: 6, data: { placeAfter: true } }]);
  });

  it("카드 사이 틈에서는 더 가까운 카드를 기준으로 판단한다", () => {
    expect(detect({ x: 200, y: 153 })).toEqual([{ id: 5, data: { placeAfter: true } }]);
    expect(detect({ x: 200, y: 157 })).toEqual([{ id: 6, data: { placeAfter: false } }]);
  });

  // TC-CLIENT-UTIL-001-32 — 드래그 중인 카드의 크기는 판단에 영향을 주지 않는다
  it("드래그 중인 카드가 아주 커도 포인터 위치로만 판단한다", () => {
    const tallDraggedRect = rect(105, 60, 80, 300); // 중심 y = 210 (6의 중심과 같음)

    expect(detect({ x: 200, y: 70 }, tallDraggedRect)).toEqual([{ id: 5, data: { placeAfter: false } }]);
    expect(detect({ x: 200, y: 20 }, tallDraggedRect)).toEqual([{ id: 5, data: { placeAfter: false } }]);
  });

  // TC-CLIENT-UTIL-001-33
  it("카드가 없는 칼럼 위에서는 칼럼 자신을 돌려준다", () => {
    expect(detect({ x: 350, y: 200 })).toEqual([{ id: columnDropId("IN_PROGRESS") }]);
  });

  // TC-CLIENT-UTIL-001-34
  it("어느 칼럼에도 속하지 않는 곳(보드 바깥, 칼럼 사이 틈)에서는 대상이 없다", () => {
    expect(detect({ x: 900, y: 200 })).toEqual([]);
    expect(detect({ x: 95, y: 200 })).toEqual([]);
  });

  it("다른 칼럼의 카드는 후보가 되지 않는다 (포인터가 있는 칼럼의 카드만)", () => {
    expect(detect({ x: 50, y: 330 })).toEqual([{ id: 1, data: { placeAfter: true } }]);
  });

  // TC-CLIENT-UTIL-001-35 — 키보드 이동은 포인터가 없어 드래그 중인 카드의 중심을 쓴다
  it("포인터가 없으면 드래그 중인 카드의 중심 좌표로 판단한다", () => {
    const keyboardRect = rect(110, 100, 80, 40); // 중심 (150, 120) → 카드 5의 아래쪽 절반

    expect(detect(null, keyboardRect)).toEqual([{ id: 5, data: { placeAfter: true } }]);
  });

  it("포인터도 드래그 영역도 없으면 대상이 없다", () => {
    expect(detect(null, null)).toEqual([]);
  });
});
