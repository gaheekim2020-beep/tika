import { Badge } from "./Badge";

// 부모가 isOverdue를 확인한 뒤 렌더링한다 (Props 없음, §5.3)
export const OverdueIndicator = () => (
  // role="img": aria-label은 역할이 없는 span에는 쓸 수 없어, 하나의 이미지로 묶어 "지연됨"을 읽게 한다
  <Badge variant="overdue" role="img" aria-label="지연됨">
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    지연
  </Badge>
);
