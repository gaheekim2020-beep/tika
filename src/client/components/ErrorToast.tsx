import { useEffect, useRef, useState } from "react";

const DISMISS_AFTER_MS = 5000;

type ErrorToastProps = {
  message: string;
  /** 사라질 때 호출한다 (useTickets.clearError에 연결, §3.5) */
  onDismiss: () => void;
};

export const ErrorToast = ({ message, onDismiss }: ErrorToastProps) => {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  // 부모가 렌더링마다 새 함수를 넘겨도 타이머가 다시 시작되지 않도록 최신 함수만 ref에 보관한다
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // message가 바뀌면 타이머를 다시 시작한다. 언마운트되면 정리해 onDismiss를 호출하지 않는다.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissedMessage(message);
      onDismissRef.current();
    }, DISMISS_AFTER_MS);

    return () => clearTimeout(timer);
  }, [message]);

  if (dismissedMessage === message) {
    return null;
  }

  return (
    <div role="alert" className="toast">
      {message}
    </div>
  );
};
