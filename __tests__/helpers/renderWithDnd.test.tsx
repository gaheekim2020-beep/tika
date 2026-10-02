import { screen } from "@testing-library/react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { renderWithDnd } from "./renderWithDnd";

const Item = ({ id }: { id: number }) => {
  const { setNodeRef, attributes, listeners } = useSortable({ id });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      item {id}
    </div>
  );
};

const Zone = () => {
  const { setNodeRef } = useDroppable({ id: "zone" });

  return <div ref={setNodeRef}>zone</div>;
};

describe("renderWithDnd 헬퍼", () => {
  it("실제 DndContext·SortableContext 안에서 폴리필 없이 오류 없이 렌더링된다 (jsdom 환경 확인)", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    renderWithDnd(
      <>
        <Item id={1} />
        <Item id={2} />
        <Zone />
      </>,
      [1, 2]
    );

    expect(screen.getByText("item 1")).toBeInTheDocument();
    expect(screen.getByText("zone")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("정렬 가능한 항목은 dnd-kit이 role=button과 tabIndex=0을 붙인다 (TicketCard 접근성 기준선)", () => {
    renderWithDnd(<Item id={1} />, [1]);

    const item = screen.getByText("item 1");
    expect(item).toHaveAttribute("role", "button");
    expect(item).toHaveAttribute("tabindex", "0");
  });

  it("rerender해도 컨텍스트가 유지된다", () => {
    const { rerender } = renderWithDnd(<Item id={1} />, [1]);

    rerender(<Item id={1} />);

    expect(screen.getByText("item 1")).toBeInTheDocument();
  });
});
