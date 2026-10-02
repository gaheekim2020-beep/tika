import { render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { dnd, resetDndMock } from "./dndMock";

// 이 파일 안에서만 DndContext/DragOverlay/useSensor를 가짜로 바꾼다
jest.mock("@dnd-kit/core", () =>
  jest.requireActual<typeof import("./dndMock")>("./dndMock").createDndCoreMock()
);

const Probe = ({ onEnd = () => undefined }: { onEnd?: (event: DragEndEvent) => void }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={(event) => {
        setActiveId(null);
        onEnd(event);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <p>active: {activeId ?? "none"}</p>
      <DragOverlay>{activeId ? <span>overlay {activeId}</span> : null}</DragOverlay>
    </DndContext>
  );
};

describe("dndMock 헬퍼", () => {
  beforeEach(() => {
    resetDndMock();
  });

  it("렌더링되기 전에 핸들러를 요청하면 원인을 알려 주는 오류가 난다", () => {
    expect(() => dnd.props()).toThrow("DndContext");
  });

  it("start()가 onDragStart를 호출하고 그 상태 변경이 화면에 반영된다", () => {
    render(<Probe />);

    dnd.start("7");

    expect(screen.getByText("active: 7")).toBeInTheDocument();
  });

  it("DragOverlay의 자식이 그대로 렌더링된다", () => {
    render(<Probe />);
    expect(screen.queryByText("overlay 7")).not.toBeInTheDocument();

    dnd.start("7");

    expect(screen.getByText("overlay 7")).toBeInTheDocument();
  });

  it("end()가 active와 over를 담은 이벤트로 onDragEnd를 호출한다", () => {
    const onEnd = jest.fn();
    render(<Probe onEnd={onEnd} />);
    dnd.start("7");

    dnd.end("7", "column:TODO");

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        active: expect.objectContaining({ id: "7" }),
        over: expect.objectContaining({ id: "column:TODO" }),
      })
    );
    expect(screen.getByText("active: none")).toBeInTheDocument();
  });

  it("over가 null이면 보드 바깥에 드롭한 이벤트로 전달된다", () => {
    const onEnd = jest.fn();
    render(<Probe onEnd={onEnd} />);

    dnd.end("7", null);

    expect(onEnd.mock.calls[0][0].over).toBeNull();
  });

  it("숫자 id도 그대로 전달한다", () => {
    const onEnd = jest.fn();
    render(<Probe onEnd={onEnd} />);

    dnd.end(7, 8);

    expect(onEnd.mock.calls[0][0].active.id).toBe(7);
    expect(onEnd.mock.calls[0][0].over.id).toBe(8);
  });

  it("cancel()이 onDragCancel을 호출한다", () => {
    render(<Probe />);
    dnd.start("7");

    dnd.cancel("7");

    expect(screen.getByText("active: none")).toBeInTheDocument();
  });

  it("리렌더링되면 항상 가장 최근 핸들러를 호출한다", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<Probe onEnd={first} />);

    rerender(<Probe onEnd={second} />);
    dnd.end("1", "2");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("useSensor 호출(센서 종류와 옵션)을 기록한다", () => {
    render(<Probe />);

    expect(dnd.sensorCalls()).toEqual([
      { sensor: PointerSensor, options: { activationConstraint: { distance: 8 } } },
      { sensor: KeyboardSensor, options: undefined },
    ]);
  });

  it("resetDndMock()이 기록과 캡처한 props를 비운다", () => {
    render(<Probe />);

    resetDndMock();

    expect(dnd.sensorCalls()).toEqual([]);
    expect(() => dnd.props()).toThrow("DndContext");
  });
});
