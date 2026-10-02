import {
  emptyResponse,
  htmlResponse,
  jsonResponse,
  mockFetch,
  networkError,
  restoreFetch,
} from "./fetchMock";

describe("fetchMock 헬퍼 (jsdom에는 fetch/Response가 없다)", () => {
  afterEach(() => {
    restoreFetch();
  });

  describe("응답 만들기", () => {
    it("jsonResponse: 2xx는 ok=true이고 json()이 본문을 돌려준다", async () => {
      const response = jsonResponse(201, { id: 1 });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ id: 1 });
    });

    it("jsonResponse: 4xx·5xx는 ok=false다", () => {
      expect(jsonResponse(400, { error: { code: "VALIDATION_ERROR" } }).ok).toBe(false);
      expect(jsonResponse(500, {}).ok).toBe(false);
    });

    it("emptyResponse: 204처럼 본문이 없으면 ok=true이고 json()은 실제 fetch처럼 실패한다", async () => {
      const response = emptyResponse(204);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(204);
      await expect(response.json()).rejects.toThrow(SyntaxError);
      await expect(response.text()).resolves.toBe("");
    });

    it("htmlResponse: JSON이 아닌 오류 본문은 json()이 실패하고 text()로 읽힌다", async () => {
      const response = htmlResponse(502, "<html>Bad Gateway</html>");

      expect(response.ok).toBe(false);
      await expect(response.json()).rejects.toThrow(SyntaxError);
      await expect(response.text()).resolves.toBe("<html>Bad Gateway</html>");
    });

    it("networkError: 연결 실패처럼 TypeError를 만든다", () => {
      expect(networkError()).toBeInstanceOf(TypeError);
    });
  });

  describe("mockFetch", () => {
    it("준비한 응답을 호출 순서대로 돌려주고 호출 내용을 기록한다", async () => {
      const fetchMock = mockFetch(jsonResponse(200, { n: 1 }), jsonResponse(200, { n: 2 }));

      const first = await fetch("/api/tickets");
      const second = await fetch("/api/tickets/7", { method: "DELETE" });

      await expect(first.json()).resolves.toEqual({ n: 1 });
      await expect(second.json()).resolves.toEqual({ n: 2 });
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/tickets");
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/tickets/7", { method: "DELETE" });
    });

    it("Error를 넘기면 그 호출이 reject된다 (네트워크 오류 재현)", async () => {
      mockFetch(networkError());

      await expect(fetch("/api/tickets")).rejects.toBeInstanceOf(TypeError);
    });

    it("준비한 응답보다 많이 호출하면 실수를 알려 주는 오류가 난다", async () => {
      mockFetch(jsonResponse(200, {}));
      await fetch("/a");

      await expect(fetch("/b")).rejects.toThrow("준비된 응답이 없습니다");
    });

    it("restoreFetch()가 원래 전역 fetch 상태로 되돌린다", () => {
      const original = globalThis.fetch;

      mockFetch(jsonResponse(200, {}));
      expect(globalThis.fetch).not.toBe(original);

      restoreFetch();
      expect(globalThis.fetch).toBe(original);
    });
  });
});
