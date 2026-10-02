type EmptyColumnStateProps = {
  /** 안내 문구 (예: "아직 카드가 없어요") */
  label: string;
};

export const EmptyColumnState = ({ label }: EmptyColumnStateProps) => (
  <p className="empty-state">{label}</p>
);
