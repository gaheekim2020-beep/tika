import { Button } from "./Button";

type ErrorBannerProps = {
  message: string;
  onRetry: () => void;
};

// 보드 초기 로드 실패 시 전체 화면에 표시한다 (§8.2)
export const ErrorBanner = ({ message, onRetry }: ErrorBannerProps) => (
  <div role="alert" className="banner-error">
    <p>{message}</p>
    <Button variant="secondary" size="sm" onClick={onRetry}>
      재시도
    </Button>
  </div>
);
