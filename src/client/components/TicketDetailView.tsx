import { COLUMN_LABELS, type TicketWithMeta } from "@/shared/types";

type TicketDetailViewProps = {
  ticket: TicketWithMeta;
};

const EMPTY_VALUE = "—";

// 사용자의 로컬 날짜 기준 YYYY-MM-DD
const formatDate = (date: Date | null) => {
  if (!date) return EMPTY_VALUE;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

// 시스템이 자동 기록하는 읽기 전용 필드만 보여 준다 (수정 가능한 필드는 TicketForm 담당)
export const TicketDetailView = ({ ticket }: TicketDetailViewProps) => {
  const rows = [
    { label: "상태", value: COLUMN_LABELS[ticket.status] },
    { label: "시작일", value: formatDate(ticket.startedAt) },
    { label: "종료일", value: formatDate(ticket.completedAt) },
    { label: "생성일", value: formatDate(ticket.createdAt) },
  ];

  return (
    <dl className="detail-list">
      {rows.map(({ label, value }) => (
        <div key={label} className="detail-row">
          <dt className="detail-label">{label}</dt>
          <dd className="detail-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
};
