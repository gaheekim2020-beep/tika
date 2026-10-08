import { useState } from "react";
import { Button } from "@/client/components/Button";
import { DeleteButton } from "@/client/components/DeleteButton";
import { TicketDetailView } from "@/client/components/TicketDetailView";
import { TicketForm } from "@/client/components/TicketForm";
import { TicketFormModal } from "@/client/components/TicketFormModal";
import { TicketModal } from "@/client/components/TicketModal";
import type { CreateTicketInput, UpdateTicketInput } from "@/shared/types";
import { makeTicket } from "../_mock/mockData";
import type { PreviewSectionDef } from "../_registry";

/*
 * Phase 5 프리뷰 — 폼 · 모달.
 * API 없이 가짜 요청(0.6초 대기)을 쓰고, "요청 결과"를 골라 성공·필드 오류·일반 오류를 모두 확인한다.
 * 필드 오류는 ApiError(message, field)와 같은 모양의 오류로 흉내 낸다.
 */

type Outcome = "success" | "field-error" | "general-error";

const OUTCOME_LABELS: Record<Outcome, string> = {
  success: "성공",
  "field-error": "필드 오류 (제목)",
  "general-error": "일반 오류",
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const simulateRequest = async (outcome: Outcome) => {
  await wait(600);
  if (outcome === "field-error") {
    throw Object.assign(new Error("서버가 거절한 제목입니다"), { field: "title" });
  }
  if (outcome === "general-error") {
    throw new Error("요청을 처리하지 못했습니다");
  }
};

const OutcomeSelect = ({ value, onChange }: { value: Outcome; onChange: (outcome: Outcome) => void }) => (
  <label className="flex items-center gap-2 text-xs text-text-secondary">
    요청 결과
    <select
      className="form-control w-auto"
      value={value}
      onChange={(event) => onChange(event.target.value as Outcome)}
    >
      {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  </label>
);

const LastResult = ({ value }: { value: string | null }) => (
  <p className="break-all font-mono text-xs text-text-secondary">마지막 호출: {value ?? "없음"}</p>
);

const sampleTicket = makeTicket({
  id: 7,
  title: "결제 모듈 마이그레이션",
  description: "PG사 API를 v2로 옮긴다.",
  status: "IN_PROGRESS",
  priority: "HIGH",
  plannedStartDate: "2099-01-01",
  dueDate: "2099-12-31",
  startedAt: new Date(2026, 8, 25, 9, 0),
});

const overdueTicket = makeTicket({
  id: 8,
  title: "이미 기한이 지난 업무",
  status: "TODO",
  dueDate: "2026-09-03",
  isOverdue: true,
  startedAt: new Date(2026, 8, 1, 9, 0),
});

const TicketFormDemo = () => {
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-xs text-text-secondary">생성 모드 (ticket 없음)</p>
          <TicketForm
            onSubmit={async (input: CreateTicketInput) => setLast(`create ${JSON.stringify(input)}`)}
            onCancel={() => setLast("cancel")}
          />
        </div>
        <div>
          <p className="mb-2 font-mono text-xs text-text-secondary">수정 모드 (ticket 있음)</p>
          <TicketForm
            ticket={sampleTicket}
            onSubmit={async (input: UpdateTicketInput) => setLast(`update ${JSON.stringify(input)}`)}
            onCancel={() => setLast("cancel")}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 font-mono text-xs text-text-secondary">errors prop (서버 400 흉내)</p>
        <div className="max-w-md">
          <TicketForm
            onSubmit={async () => undefined}
            onCancel={() => undefined}
            errors={{ title: "서버가 거절한 제목입니다", dueDate: "종료예정일은 오늘 이후 날짜를 선택해주세요" }}
          />
        </div>
      </div>
      <LastResult value={last} />
    </div>
  );
};

const TicketDetailViewDemo = () => (
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <p className="mb-2 font-mono text-xs text-text-secondary">진행 중 (종료일 없음)</p>
      <TicketDetailView ticket={sampleTicket} />
    </div>
    <div>
      <p className="mb-2 font-mono text-xs text-text-secondary">완료</p>
      <TicketDetailView
        ticket={makeTicket({
          status: "DONE",
          startedAt: new Date(2026, 8, 1, 9, 0),
          completedAt: new Date(2026, 8, 20, 9, 0),
        })}
      />
    </div>
  </div>
);

const TicketFormModalDemo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("success");
  const [last, setLast] = useState<string | null>(null);

  const handleSubmit = async (input: CreateTicketInput) => {
    await simulateRequest(outcome);
    setLast(JSON.stringify(input));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setIsOpen(true)}>새 업무 모달 열기</Button>
        <OutcomeSelect value={outcome} onChange={setOutcome} />
      </div>
      <LastResult value={last} />
      <TicketFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSubmit={handleSubmit} />
    </div>
  );
};

type ModalMode = "ok" | "overdue" | "loading" | "error";

const TicketModalDemo = () => {
  const [mode, setMode] = useState<ModalMode | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("success");
  const [last, setLast] = useState<string | null>(null);

  const handleSubmit = async (id: number, input: UpdateTicketInput) => {
    await simulateRequest(outcome);
    setLast(`update #${id} ${JSON.stringify(input)}`);
  };

  const handleDelete = async (id: number) => {
    await simulateRequest(outcome);
    setLast(`delete #${id}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setMode("ok")}>정상</Button>
        <Button variant="secondary" onClick={() => setMode("overdue")}>
          기한 지난 티켓
        </Button>
        <Button variant="secondary" onClick={() => setMode("loading")}>
          조회 중
        </Button>
        <Button variant="secondary" onClick={() => setMode("error")}>
          조회 실패
        </Button>
        <OutcomeSelect value={outcome} onChange={setOutcome} />
      </div>
      <LastResult value={last} />
      <TicketModal
        isOpen={mode !== null}
        ticket={mode === "ok" ? sampleTicket : mode === "overdue" ? overdueTicket : null}
        isLoading={mode === "loading"}
        error={mode === "error" ? "존재하지 않거나 삭제된 티켓입니다" : null}
        onClose={() => setMode(null)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export const phase5Sections: PreviewSectionDef[] = [
  {
    id: "ticket-form",
    phase: "P5",
    title: "TicketForm",
    spec: "COMPONENT_SPEC §6.2 · TC-COMP-006-01·06·07·09, 007-05·08·09",
    note: "확인: 생성 모드는 빈 값·MEDIUM·'생성', 수정 모드는 기존 값·'저장'. 제목 비우기 / 과거 종료예정일 입력 시 필드 아래 빨간 오류, errors prop 오류 표시, 날짜 선택기가 오늘 이전을 막는가.",
    render: () => <TicketFormDemo />,
  },
  {
    id: "ticket-detail-view",
    phase: "P5",
    title: "TicketDetailView",
    spec: "COMPONENT_SPEC §6.2 · TC-COMP-007-03·04",
    note: "확인: 상태·시작일·종료일·생성일이 일반 텍스트로 정렬되는가, 값이 없으면 '—'로 보이는가.",
    render: () => <TicketDetailViewDemo />,
  },
  {
    id: "delete-button",
    phase: "P5",
    title: "DeleteButton",
    spec: "COMPONENT_SPEC §6.3 · TC-COMP-008-01",
    note: "확인: danger variant(빨강)로 보이는가.",
    render: () => <DeleteButton onClick={() => undefined} />,
  },
  {
    id: "ticket-form-modal",
    phase: "P5",
    title: "TicketFormModal",
    spec: "COMPONENT_SPEC §6.1 · TC-COMP-006-01~09",
    note: "확인: 열릴 때 제목에 포커스, 생성 중 버튼 스피너, 요청 결과를 바꿔 필드 오류(제목 아래)·일반 오류(토스트) 표시, Esc·취소·바깥 클릭으로 닫힘.",
    contained: true,
    render: () => <TicketFormModalDemo />,
  },
  {
    id: "ticket-modal",
    phase: "P5",
    title: "TicketModal",
    spec: "COMPONENT_SPEC §6.2·§6.3 · TC-COMP-007-01~12, 008-01~06",
    note: "확인: 조회 중 스켈레톤, 조회 실패 메시지(폼·삭제 없음), 변경한 필드만 호출되는지(마지막 호출 문구), 기한 지난 티켓은 종료예정일을 안 바꾸면 저장됨, 삭제 확인 다이얼로그 기본 포커스(취소), 삭제 실패 시 두 모달 유지.",
    contained: true,
    render: () => <TicketModalDemo />,
  },
];
