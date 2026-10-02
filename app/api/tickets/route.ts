import { NextResponse } from "next/server";
import { createTicketSchema } from "@/shared/validations/ticket";
import { createTicket, getBoardData } from "@/server/services/ticketService";

const invalidBodyResponse = (): Response =>
  NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "요청 본문이 올바른 JSON 형식이 아닙니다",
      },
    },
    { status: 400 }
  );

export async function GET(): Promise<Response> {
  try {
    const board = await getBoardData();
    return NextResponse.json(board, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "티켓 목록을 불러오지 못했습니다" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBodyResponse();
  }

  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    // path가 비어 있으면 특정 필드가 아니라 본문 전체(객체가 아님)가 잘못된 것이다
    if (issue.path.length === 0) {
      return invalidBodyResponse();
    }

    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          field: issue.path[0],
          message: issue.message,
        },
      },
      { status: 400 }
    );
  }

  try {
    const ticket = await createTicket(parsed.data);
    return NextResponse.json(ticket, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
