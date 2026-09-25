import { NextResponse } from "next/server";
import { createTicketSchema } from "@/shared/validations/ticket";
import { createTicket, getBoardData } from "@/server/services/ticketService";

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
  const body: unknown = await request.json();
  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
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
