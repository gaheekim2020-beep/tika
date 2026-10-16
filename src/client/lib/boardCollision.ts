import type { CollisionDetection } from "@dnd-kit/core";
import { isColumnDropId } from "./boardUtils";

type Point = { x: number; y: number };
type Box = { left: number; right: number; top: number; bottom: number; height: number };

const contains = (box: Box, point: Point) =>
  point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;

const verticalDistance = (box: Box, y: number) => (y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0);

/**
 * 보드의 드롭 대상을 고른다. 기준은 **포인터 위치 하나**다 (드래그 중인 카드의 크기·중심은 쓰지 않는다).
 * 1. 포인터가 속한 칼럼을 찾는다. 어느 칼럼에도 없으면(보드 바깥, 칼럼 사이 틈) 대상이 없다.
 * 2. 그 칼럼에 카드가 있으면 세로로 가장 가까운 카드를 대상으로 삼고, 포인터가 그 카드의 중심보다 아래면
 *    `data.placeAfter = true`를 붙인다. 첫 카드 위 여백은 첫 카드의 앞, 마지막 카드 아래 여백은 마지막 카드의 뒤가 된다.
 * 3. 카드가 없는 칼럼이면 칼럼 자신을 대상으로 삼는다.
 * 키보드 조작처럼 포인터가 없으면 드래그 중인 카드의 중심 좌표를 대신 쓴다.
 */
export const boardCollisionDetection: CollisionDetection = ({
  droppableContainers,
  droppableRects,
  pointerCoordinates,
  collisionRect,
}) => {
  const point: Point | null =
    pointerCoordinates ??
    (collisionRect ? { x: collisionRect.left + collisionRect.width / 2, y: collisionRect.top + collisionRect.height / 2 } : null);
  if (!point) return [];

  const entries = droppableContainers.flatMap((container) => {
    const box = droppableRects.get(container.id);
    return box && !container.disabled ? [{ id: container.id, box }] : [];
  });

  const column = entries.find((entry) => isColumnDropId(entry.id) && contains(entry.box, point));
  if (!column) return [];

  const cards = entries.filter(
    (entry) => !isColumnDropId(entry.id) && entry.box.left >= column.box.left && entry.box.right <= column.box.right
  );
  if (cards.length === 0) return [{ id: column.id }];

  const nearest = cards.reduce((best, card) =>
    verticalDistance(card.box, point.y) < verticalDistance(best.box, point.y) ? card : best
  );

  return [{ id: nearest.id, data: { placeAfter: point.y > nearest.box.top + nearest.box.height / 2 } }];
};
