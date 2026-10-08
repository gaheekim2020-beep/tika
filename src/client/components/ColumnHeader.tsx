type ColumnHeaderProps = {
  /** `COLUMN_LABELS[status]` 값 */
  label: string;
  /** 카드 수 (US-003) */
  count: number;
  /** false이면 카드 수를 숨긴다 (Backlog 칼럼용, 기본값 true) */
  showCount?: boolean;
};

export const ColumnHeader = ({ label, count, showCount = true }: ColumnHeaderProps) => (
  <div className="column-header">
    <h2 className="column-title">{label}</h2>
    {showCount && <span className="column-count">{count}</span>}
  </div>
);
