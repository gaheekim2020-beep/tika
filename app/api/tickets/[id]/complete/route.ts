import { NextResponse } from "next/server";
import { ticketIdParamSchema } from "@/shared/validations/ticket";
import { completeTicket } from "@/server/services/ticketService";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const parsed = ticketIdParamSchema.safeParse(id);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "유효하지 않은 티켓 ID입니다" } },
      { status: 400 }
    );
  }

  try {
    const ticket = await completeTicket(parsed.data);
    if (!ticket) {
      return NextResponse.json(
        {
          error: {
            code: "TICKET_NOT_FOUND",
            message: "존재하지 않거나 삭제된 티켓입니다",
          },
        },
        { status: 404 }
      );
    }
    return NextResponse.json(ticket, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "티켓을 완료 처리하지 못했습니다" } },
      { status: 500 }
    );
  }
}
