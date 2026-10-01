import { NextResponse } from "next/server";
import { reorderTicketSchema } from "@/shared/validations/ticket";
import { reorderTicket } from "@/server/services/ticketService";

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

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBodyResponse();
  }

  const parsed = reorderTicketSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    if (issue.path.length === 0) {
      return invalidBodyResponse();
    }

    // status 오류에는 field를 싣지 않는다 (API_SPEC §7, TC-API-COMMON-03)
    if (issue.path[0] === "status") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: issue.message } },
        { status: 400 }
      );
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
    const board = await reorderTicket(parsed.data);
    if (!board) {
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
    return NextResponse.json(board, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "티켓 순서를 변경하지 못했습니다" } },
      { status: 500 }
    );
  }
}
