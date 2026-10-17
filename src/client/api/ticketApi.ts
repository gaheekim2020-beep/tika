import {
  COLUMN_ORDER,
  type BoardData,
  type CreateTicketInput,
  type ReorderTicketInput,
  type TicketStatus,
  type TicketWithMeta,
  type UpdateTicketInput,
} from "@/shared/types";

const TICKETS_URL = "/api/tickets";
const NETWORK_ERROR_MESSAGE = "서버에 연결하지 못했습니다. 네트워크를 확인해주세요";
const UNKNOWN_ERROR_MESSAGE = "요청을 처리하지 못했습니다";

type ApiErrorInit = {
  status: number;
  code: string;
  message: string;
  field?: string;
};

/**
 * API 호출 실패를 한 종류로 통일한 오류. 서버 오류 응답({ error: { code, message, field? } }),
 * JSON이 아닌 오류 응답(UNKNOWN_ERROR), 네트워크 오류(NETWORK_ERROR, status 0)가 모두 이 클래스로 온다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor({ status, code, message, field }: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// 서버는 시각 필드를 ISO 문자열로 보낸다. 화면에서 쓰는 TicketWithMeta는 Date를 기대한다.
type WireTicket = Omit<TicketWithMeta, "startedAt" | "completedAt" | "createdAt" | "updatedAt"> & {
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WireBoard = Record<TicketStatus, WireTicket[]>;

const toNullableDate = (value: string | null) => (value === null ? null : new Date(value));

// plannedStartDate·dueDate("YYYY-MM-DD")는 그대로 둔다
const parseTicket = (wire: WireTicket): TicketWithMeta => ({
  ...wire,
  startedAt: toNullableDate(wire.startedAt),
  completedAt: toNullableDate(wire.completedAt),
  createdAt: new Date(wire.createdAt),
  updatedAt: new Date(wire.updatedAt),
});

const parseBoard = (wire: WireBoard): BoardData =>
  COLUMN_ORDER.reduce((board, status) => {
    board[status] = wire[status].map(parseTicket);
    return board;
  }, {} as BoardData);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// 오류 응답 본문이 { error: { code, message, field? } } 모양이면 그대로 담고, 아니면 UNKNOWN_ERROR로 만든다
const toApiError = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => null);
  const detail = isRecord(body) && isRecord(body.error) ? body.error : null;

  if (detail && typeof detail.code === "string" && typeof detail.message === "string") {
    return new ApiError({
      status: response.status,
      code: detail.code,
      message: detail.message,
      field: typeof detail.field === "string" ? detail.field : undefined,
    });
  }

  return new ApiError({ status: response.status, code: "UNKNOWN_ERROR", message: UNKNOWN_ERROR_MESSAGE });
};

type RequestOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

// fetch는 4xx/5xx에서도 예외를 던지지 않으므로 response.ok를 직접 확인한다. 이 파일의 모든 요청이 여기를 거친다.
const request = async (path: string, { method, body }: RequestOptions): Promise<Response> => {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      ...(body !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: NETWORK_ERROR_MESSAGE });
  }

  if (!response.ok) throw await toApiError(response);

  return response;
};

const requestJson = async <T>(path: string, options: RequestOptions): Promise<T> => {
  const response = await request(path, options);
  const data: unknown = await response.json();

  return data as T;
};

export const fetchBoard = async (): Promise<BoardData> =>
  parseBoard(await requestJson<WireBoard>(TICKETS_URL, { method: "GET" }));

export const fetchTicket = async (id: number): Promise<TicketWithMeta> =>
  parseTicket(await requestJson<WireTicket>(`${TICKETS_URL}/${id}`, { method: "GET" }));

export const createTicket = async (input: CreateTicketInput): Promise<TicketWithMeta> =>
  parseTicket(await requestJson<WireTicket>(TICKETS_URL, { method: "POST", body: input }));

export const updateTicket = async (id: number, input: UpdateTicketInput): Promise<TicketWithMeta> =>
  parseTicket(await requestJson<WireTicket>(`${TICKETS_URL}/${id}`, { method: "PATCH", body: input }));

// 204(본문 없음)라서 응답 본문은 읽지 않는다
export const deleteTicket = async (id: number): Promise<void> => {
  await request(`${TICKETS_URL}/${id}`, { method: "DELETE" });
};

export const completeTicket = async (id: number): Promise<TicketWithMeta> =>
  parseTicket(await requestJson<WireTicket>(`${TICKETS_URL}/${id}/complete`, { method: "PATCH" }));

export const reorderTicket = async (input: ReorderTicketInput): Promise<BoardData> =>
  parseBoard(await requestJson<WireBoard>(`${TICKETS_URL}/reorder`, { method: "PATCH", body: input }));
