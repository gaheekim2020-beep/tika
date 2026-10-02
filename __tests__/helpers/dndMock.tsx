import { act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DndContextProps, DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";

/*
 * dnd-kit mock 헬퍼 — jsdom에는 레이아웃이 없어 실제 드래그를 시뮬레이션하기 어렵다.
 * `DndContext`를 가짜로 바꿔 Board가 넘기는 핸들러를 캡처하고, 가짜 이벤트로 직접 호출한다.
 *
 * 사용법 (docs/FRONTEND_TASKS.md §1.3):
 *
 *   import { dnd, resetDndMock } from "../helpers/dndMock";
 *
 *   jest.mock("@dnd-kit/core", () =>
 *     jest.requireActual<typeof import("../helpers/dndMock")>("../helpers/dndMock").createDndCoreMock()
 *   );
 *   beforeEach(resetDndMock);
 *
 *   render(<Board ... />);
 *   dnd.end(7, "column:TODO");   // 7번 카드를 TODO 칼럼 위에서 놓은 것처럼 onDragEnd 호출
 *
 * 주의: 이 파일은 `@dnd-kit/core`의 값을 import하지 않는다 (mock 팩토리가 이 파일을 불러오므로
 * 순환이 생긴다). 타입 import만 사용한다.
 */

type Id = string | number;

interface SensorCall {
  sensor: unknown;
  options: unknown;
}

const state: { props: DndContextProps | null; sensorCalls: SensorCall[] } = {
  props: null,
  sensorCalls: [],
};

/** jest.mock("@dnd-kit/core", ...) 팩토리에서 호출한다. 실제 모듈에서 DndContext 등만 바꾼다. */
export const createDndCoreMock = () => {
  const actual = jest.requireActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");

  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      state.props = props;
      return <>{props.children}</>;
    },
    // 진짜 DragOverlay는 DndContext 안의 드래그 상태가 있어야 자식을 그린다. 자식을 항상 그리게 바꾼다.
    DragOverlay: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useSensor: (sensor: unknown, options?: unknown) => {
      state.sensorCalls.push({ sensor, options });
      type UseSensorArgs = Parameters<typeof actual.useSensor>;
      return actual.useSensor(sensor as UseSensorArgs[0], options as UseSensorArgs[1]);
    },
  };
};

export const resetDndMock = () => {
  state.props = null;
  state.sensorCalls = [];
};

// 핸들러가 읽는 필드만 채운 가짜 이벤트. 실제 이벤트 전체를 흉내 내지 않는다.
const makeActive = (id: Id) => ({ id, data: { current: undefined }, rect: { current: { initial: null, translated: null } } });
const makeOver = (id: Id) => ({ id, data: { current: undefined }, rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }, disabled: false });

const makeEvent = <T,>(activeId: Id, overId?: Id | null): T =>
  ({
    active: makeActive(activeId),
    over: overId === undefined || overId === null ? null : makeOver(overId),
    delta: { x: 0, y: 0 },
    collisions: null,
    activatorEvent: new Event("pointerdown"),
  }) as unknown as T;

const getProps = (): DndContextProps => {
  if (!state.props) {
    throw new Error("DndContext가 렌더링되지 않았습니다. 먼저 render()로 보드를 렌더링하고 jest.mock(\"@dnd-kit/core\")을 확인하세요.");
  }
  return state.props;
};

export const dnd = {
  /** 가장 최근에 렌더링된 DndContext의 props */
  props: getProps,
  start: (activeId: Id) => {
    const handler = getProps().onDragStart;
    act(() => handler?.(makeEvent<DragStartEvent>(activeId)));
  },
  over: (activeId: Id, overId: Id | null) => {
    const handler = getProps().onDragOver;
    act(() => handler?.(makeEvent<DragOverEvent>(activeId, overId)));
  },
  /** overId가 null이면 보드 바깥에 놓은 것 */
  end: (activeId: Id, overId: Id | null) => {
    const handler = getProps().onDragEnd;
    act(() => handler?.(makeEvent<DragEndEvent>(activeId, overId)));
  },
  cancel: (activeId: Id) => {
    const handler = getProps().onDragCancel;
    act(() => handler?.(makeEvent<DragCancelEvent>(activeId)));
  },
  /** useSensor 호출 기록 (센서 종류와 옵션) — TRD §1.5 센서 구성 검증용 */
  sensorCalls: (): SensorCall[] => [...state.sensorCalls],
};
