import { NextResponse } from "next/server";
import {
  ticketIdParamSchema,
  updateTicketSchema,
} from "@/shared/validations/ticket";
import {
  deleteTicket,
  getTicketById,
  updateTicket,
} from "@/server/services/ticketService";

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

export async function GET(
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
    const ticket = await getTicketById(parsed.data);
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
      { error: { code: "INTERNAL_ERROR", message: "티켓을 불러오지 못했습니다" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const parsedId = ticketIdParamSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "유효하지 않은 티켓 ID입니다" } },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBodyResponse();
  }

  const parsed = updateTicketSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
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
    const ticket = await updateTicket(parsedId.data, parsed.data);
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
      { error: { code: "INTERNAL_ERROR", message: "티켓을 수정하지 못했습니다" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const deleted = await deleteTicket(parsed.data);
    if (!deleted) {
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
    // 204는 본문을 가질 수 없으므로 NextResponse.json을 쓰지 않는다
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "티켓을 삭제하지 못했습니다" } },
      { status: 500 }
    );
  }
}
