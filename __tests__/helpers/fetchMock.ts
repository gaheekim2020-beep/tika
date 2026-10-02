/*
 * fetch mock 헬퍼 — jsdom 환경에는 fetch / Response / Request가 없다.
 * ticketApi 테스트에서 서버 응답을 흉내 내는 데 쓴다 (docs/FRONTEND_TASKS.md §1.3).
 *
 *   const fetchMock = mockFetch(jsonResponse(201, ticket));
 *   await createTicket({ title: "새 업무" });
 *   expect(fetchMock).toHaveBeenCalledWith("/api/tickets", expect.objectContaining({ method: "POST" }));
 *
 * 각 테스트 뒤에 `afterEach(restoreFetch)`로 전역 fetch를 되돌린다.
 */

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

const toResponse = (fake: FakeResponse): Response => fake as unknown as Response;

const notJson = (text: string) => async () => {
  throw new SyntaxError(`Unexpected token in JSON: ${text.slice(0, 20)}`);
};

/** JSON 본문이 있는 응답 (200, 201, 400, 404, 500 등) */
export const jsonResponse = (status: number, body: unknown): Response =>
  toResponse({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

/** 본문이 없는 응답 (204 등). 실제 fetch처럼 json()은 실패한다. */
export const emptyResponse = (status: number): Response =>
  toResponse({ ok: status >= 200 && status < 300, status, json: notJson(""), text: async () => "" });

/** JSON이 아닌 오류 본문 (게이트웨이가 돌려주는 HTML 등) */
export const htmlResponse = (status: number, html: string): Response =>
  toResponse({ ok: status >= 200 && status < 300, status, json: notJson(html), text: async () => html });

/** 연결 실패처럼 fetch 자체가 reject되는 상황 */
export const networkError = (): TypeError => new TypeError("Failed to fetch");

const originalFetch = globalThis.fetch;

/** 전역 fetch를 가짜로 바꾼다. 인자는 호출 순서대로 돌려줄 응답(또는 reject할 Error)이다. */
export const mockFetch = (...steps: Array<Response | Error>): jest.Mock => {
  const fetchMock = jest.fn();

  steps.forEach((step) => {
    if (step instanceof Error) {
      fetchMock.mockRejectedValueOnce(step);
    } else {
      fetchMock.mockResolvedValueOnce(step);
    }
  });
  // 준비한 응답보다 많이 호출되면 테스트 작성 실수이므로 조용히 undefined를 주지 않고 실패시킨다
  fetchMock.mockRejectedValue(new Error("mockFetch: 준비된 응답이 없습니다"));

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

export const restoreFetch = (): void => {
  globalThis.fetch = originalFetch;
};
