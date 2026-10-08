import { COLUMN_ORDER } from "@/shared/types";

// 칼럼마다 카드 자리 표시 개수를 조금씩 다르게 해서 실제 보드처럼 보이게 한다
const CARD_COUNT = [3, 2, 2, 1];

// 레이아웃은 실제 보드(.board, .column)를 그대로 써서 반응형 배치가 같다
export const BoardSkeleton = () => (
  <div role="status" aria-busy="true" aria-label="보드를 불러오는 중">
    <div className="board">
      {COLUMN_ORDER.map((status, index) => (
        <div key={status} className={status === "BACKLOG" ? "column column--backlog" : "column"}>
          <div className="skeleton mb-3 h-4 w-24" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: CARD_COUNT[index] }, (_, cardIndex) => (
              <div key={cardIndex} className="skeleton h-20" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
