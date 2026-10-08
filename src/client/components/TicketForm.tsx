import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import {
  TICKET_PRIORITY,
  type CreateTicketInput,
  type TicketPriority,
  type TicketWithMeta,
  type UpdateTicketInput,
} from "@/shared/types";
import { getChangedFields } from "@/client/lib/getChangedFields";
import { createTicketSchema, updateTicketSchema } from "@/shared/validations/ticket";
import { Button } from "./Button";

type TicketFormProps = {
  onCancel: () => void;
  /** 필드별 에러 메시지. key는 API 400 응답의 `error.field`와 같다 (서버·클라이언트 검증을 같은 방식으로 표시) */
  errors?: Record<string, string>;
} & (
  | { ticket?: undefined; onSubmit: (input: CreateTicketInput) => Promise<void> }
  | { ticket: TicketWithMeta; onSubmit: (input: UpdateTicketInput) => Promise<void> }
);

type FormValues = {
  title: string;
  description: string;
  priority: TicketPriority;
  plannedStartDate: string;
  dueDate: string;
};

type FieldName = keyof FormValues;

const PRIORITIES = Object.values(TICKET_PRIORITY);

const INITIAL_VALUES: FormValues = {
  title: "",
  description: "",
  priority: TICKET_PRIORITY.MEDIUM,
  plannedStartDate: "",
  dueDate: "",
};

const getInitialValues = (ticket?: TicketWithMeta): FormValues =>
  ticket
    ? {
        title: ticket.title,
        description: ticket.description ?? "",
        priority: ticket.priority,
        plannedStartDate: ticket.plannedStartDate ?? "",
        dueDate: ticket.dueDate ?? "",
      }
    : INITIAL_VALUES;

// 사용자의 로컬 날짜 기준 YYYY-MM-DD (종료예정일 입력의 min)
const getToday = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

// 생성: 비운 설명·날짜는 본문에서 생략한다 (API_SPEC §1)
const buildCreatePayload = (values: FormValues) => ({
  title: values.title,
  priority: values.priority,
  ...(values.description && { description: values.description }),
  ...(values.plannedStartDate && { plannedStartDate: values.plannedStartDate }),
  ...(values.dueDate && { dueDate: values.dueDate }),
});

// 수정: 비운 설명·날짜는 null로 보내 지운다 (API_SPEC §4)
const buildUpdatePayload = (values: FormValues) => ({
  title: values.title,
  description: values.description || null,
  priority: values.priority,
  plannedStartDate: values.plannedStartDate || null,
  dueDate: values.dueDate || null,
});

// zod 오류에서 필드마다 첫 메시지만 모은다
const collectErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.reduce<Record<string, string>>((acc, issue) => {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in acc)) acc[field] = issue.message;
    return acc;
  }, {});

export const TicketForm = ({ ticket, onSubmit, onCancel, errors = {} }: TicketFormProps) => {
  const formId = useId();
  const [values, setValues] = useState<FormValues>(() => getInitialValues(ticket));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = ticket !== undefined;
  // 수정 모드는 값이 바뀌기 전까지 저장할 수 없다. 제목은 제출 시 trim되므로 앞뒤 공백만 바뀐 건 변경이 아니다.
  const isDirty = ticket
    ? Object.keys(getChangedFields(ticket, { ...buildUpdatePayload(values), title: values.title.trim() })).length > 0
    : true;
  const messageOf = (field: FieldName) => clientErrors[field] ?? errors[field];

  const handleChange =
    (field: FieldName) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !isDirty) return;

    if (ticket) {
      // 이미 지난 종료예정일을 바꾸지 않았다면 "오늘 이후" 검증 대상에서 뺀다 (지연 티켓 수정을 막지 않기 위함)
      const payload = buildUpdatePayload(values);
      const { dueDate, ...rest } = payload;
      const isDueDateChanged = values.dueDate !== (ticket.dueDate ?? "");
      const result = updateTicketSchema.safeParse(isDueDateChanged ? payload : rest);

      if (!result.success) {
        setClientErrors(collectErrors(result.error.issues));
        return;
      }

      setClientErrors({});
      await submit(() => (onSubmit as (input: UpdateTicketInput) => Promise<void>)({ ...result.data, dueDate }));
      return;
    }

    const result = createTicketSchema.safeParse(buildCreatePayload(values));

    if (!result.success) {
      setClientErrors(collectErrors(result.error.issues));
      return;
    }

    setClientErrors({});
    await submit(() => (onSubmit as (input: CreateTicketInput) => Promise<void>)(result.data));
  };

  const submit = async (run: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await run();
    } catch {
      // 실패 표시는 호출부(TicketFormModal/TicketModal)의 책임이다. 여기서는 예외가 번지지 않게 하고 버튼만 되살린다.
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldProps = (field: FieldName) => {
    const message = messageOf(field);

    return {
      id: `${formId}-${field}`,
      value: values[field],
      onChange: handleChange(field),
      "aria-invalid": message ? (true as const) : undefined,
      "aria-describedby": message ? `${formId}-${field}-error` : undefined,
    };
  };

  const renderError = (field: FieldName) => {
    const message = messageOf(field);

    return message ? (
      <p id={`${formId}-${field}-error`} className="form-error">
        {message}
      </p>
    ) : null;
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label className="form-label" htmlFor={`${formId}-title`}>
          제목
        </label>
        <input type="text" className="form-control" {...fieldProps("title")} />
        {renderError("title")}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor={`${formId}-description`}>
          설명
        </label>
        <textarea className="form-control" {...fieldProps("description")} />
        {renderError("description")}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor={`${formId}-priority`}>
          우선순위
        </label>
        <select className="form-control" {...fieldProps("priority")}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        {renderError("priority")}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor={`${formId}-plannedStartDate`}>
            시작예정일
          </label>
          <input type="date" className="form-control" {...fieldProps("plannedStartDate")} />
          {renderError("plannedStartDate")}
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor={`${formId}-dueDate`}>
            종료예정일
          </label>
          <input type="date" className="form-control" min={getToday()} {...fieldProps("dueDate")} />
          {renderError("dueDate")}
        </div>
      </div>

      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
          {isEdit ? "저장" : "생성"}
        </Button>
      </div>
    </form>
  );
};
