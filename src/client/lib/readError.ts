/**
 * 모달이 요청 실패를 화면에 보여 줄 때 필요한 값만 읽는다.
 * ApiError(message, field?)와 같은 모양이면 되므로 API 계층(ticketApi)에 직접 의존하지 않는다.
 * - field가 있으면 해당 입력창 아래에, 없으면 토스트로 보여 준다 (D3).
 */
export const readError = (error: unknown, fallback: string): { message: string; field?: string } => {
  if (error instanceof Error) {
    const field = "field" in error && typeof error.field === "string" ? error.field : undefined;
    return { message: error.message || fallback, field };
  }
  return { message: fallback };
};
