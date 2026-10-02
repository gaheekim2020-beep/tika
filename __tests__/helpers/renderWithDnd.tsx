import { render, type RenderResult } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { ReactElement, ReactNode } from "react";

type Id = string | number;

/**
 * 실제 DndContext + SortableContext로 감싸서 렌더링한다.
 * `useSortable`/`useDroppable`을 쓰는 TicketCard·Column이 컨텍스트 안에서 동작하는지 확인할 때 쓴다.
 * 드래그 동작 자체는 검증하지 않는다 (그건 dndMock으로 핸들러를 직접 호출한다).
 */
export const renderWithDnd = (ui: ReactElement, items: Id[] = []): RenderResult => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <DndContext>
      <SortableContext items={items}>{children}</SortableContext>
    </DndContext>
  );

  return render(ui, { wrapper: Wrapper });
};
