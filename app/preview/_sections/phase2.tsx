import { useState } from "react";
import { Badge, type BadgeVariant } from "@/client/components/Badge";
import { BoardSkeleton } from "@/client/components/BoardSkeleton";
import { Button, type ButtonSize, type ButtonVariant } from "@/client/components/Button";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyColumnState } from "@/client/components/EmptyColumnState";
import { ErrorBanner } from "@/client/components/ErrorBanner";
import { ErrorToast } from "@/client/components/ErrorToast";
import { Modal } from "@/client/components/Modal";
import { OverdueIndicator } from "@/client/components/OverdueIndicator";
import { PriorityBadge } from "@/client/components/PriorityBadge";
import type { PreviewSectionDef } from "../_registry";

/*
 * Phase 2 프리뷰 — UI primitive · 말단 컴포넌트.
 * 각 데모는 사람이 눈으로 확인할 항목(색상 구분, 포커스, 키보드 조작)을 note에 적어 둔다.
 */

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "danger", "ghost"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const BADGE_VARIANTS: BadgeVariant[] = ["low", "medium", "high", "overdue", "neutral"];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const RowLabel = ({ children }: { children: string }) => (
  <span className="w-14 shrink-0 font-mono text-xs text-text-secondary">{children}</span>
);

const ButtonDemo = () => {
  const [clicks, setClicks] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <RowLabel>{size}</RowLabel>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size={size} onClick={() => setClicks((count) => count + 1)}>
              {variant}
            </Button>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <RowLabel>상태</RowLabel>
        <Button isLoading>로딩 중</Button>
        <Button variant="secondary" isLoading>
          로딩 중
        </Button>
        <Button disabled>비활성</Button>
      </div>
      <p className="text-xs text-text-secondary">클릭 횟수: {clicks} (로딩·비활성 버튼은 세지 않습니다)</p>
    </div>
  );
};

const BadgeDemo = () => (
  <div className="flex flex-wrap items-center gap-3">
    {BADGE_VARIANTS.map((variant) => (
      <Badge key={variant} variant={variant}>
        {variant}
      </Badge>
    ))}
  </div>
);

const PriorityBadgeDemo = () => (
  <div className="flex flex-wrap items-center gap-3">
    <PriorityBadge priority="LOW" />
    <PriorityBadge priority="MEDIUM" />
    <PriorityBadge priority="HIGH" />
  </div>
);

const EmptyColumnDemo = () => (
  <div className="column w-72">
    <div className="column-header">
      <h4 className="column-title">TODO</h4>
      <span className="column-count">0</span>
    </div>
    <div className="card-list">
      <EmptyColumnState label="아직 카드가 없어요" />
    </div>
  </div>
);

const ErrorBannerDemo = () => {
  const [retries, setRetries] = useState(0);

  return (
    <div>
      <ErrorBanner message="티켓 목록을 불러오지 못했습니다" onRetry={() => setRetries((count) => count + 1)} />
      <p className="text-xs text-text-secondary">재시도 클릭 횟수: {retries}</p>
    </div>
  );
};

const ErrorToastDemo = () => {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const show = () => {
    setCount((current) => current + 1);
    setMessage(`티켓을 저장하지 못했습니다 (${count + 1}번째)`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={show}>토스트 띄우기</Button>
        <Button variant="secondary" onClick={show} disabled={message === null}>
          표시 중에 메시지 바꾸기
        </Button>
      </div>
      <p className="text-xs text-text-secondary">띄운 횟수: {count} · 5초 뒤 자동으로 사라지고, 표시 중에 바꾸면 5초가 다시 시작됩니다.</p>
      {message ? <ErrorToast message={message} onDismiss={() => setMessage(null)} /> : null}
    </div>
  );
};

const ModalDemo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isNestedOpen, setIsNestedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button onClick={() => setIsOpen(true)}>모달 열기</Button>
      </div>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} ariaLabelledBy="preview-modal-title">
        <h3 id="preview-modal-title" className="modal-title">
          새 업무 만들기
        </h3>
        <div className="form-field">
          <label className="form-label" htmlFor="preview-modal-input">
            제목
          </label>
          <input id="preview-modal-input" className="form-control" placeholder="열리면 여기에 포커스가 있어야 합니다" />
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsNestedOpen(true)}>
            안쪽 모달 열기
          </Button>
          <Button onClick={() => setIsOpen(false)}>닫기</Button>
        </div>
        <Modal isOpen={isNestedOpen} onClose={() => setIsNestedOpen(false)} ariaLabel="안쪽 모달">
          <h3 className="modal-title">안쪽 모달</h3>
          <p className="text-[13px] text-text-secondary">Esc를 누르면 이 모달만 닫혀야 합니다.</p>
          <div className="modal-actions">
            <Button onClick={() => setIsNestedOpen(false)}>닫기</Button>
          </div>
        </Modal>
      </Modal>
    </div>
  );
};

type ConfirmKind = "danger" | "normal" | "fail" | null;

const ConfirmDialogDemo = () => {
  const [open, setOpen] = useState<ConfirmKind>(null);
  const [result, setResult] = useState("아직 확인하지 않았습니다");

  const handleConfirm = async () => {
    await wait(1200);
    if (open === "fail") {
      setResult("실패했습니다 — 대화상자가 열린 채 확인 버튼이 다시 활성화돼야 합니다");
      throw new Error("확인 처리 실패");
    }
    setResult(`확인했습니다 (${open})`);
    setOpen(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => setOpen("danger")}>
          삭제 확인 (danger)
        </Button>
        <Button variant="secondary" onClick={() => setOpen("normal")}>
          일반 확인
        </Button>
        <Button variant="secondary" onClick={() => setOpen("fail")}>
          실패하는 확인
        </Button>
      </div>
      <p className="text-xs text-text-secondary">결과: {result}</p>
      <ConfirmDialog
        isOpen={open !== null}
        title={open === "danger" ? "정말 삭제하시겠습니까?" : "계속 진행하시겠습니까?"}
        danger={open === "danger"}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(null)}
      />
    </div>
  );
};

export const phase2Sections: PreviewSectionDef[] = [
  {
    id: "button",
    phase: "P2",
    title: "Button",
    spec: "COMPONENT_SPEC §8.8 · TC-COMP-009-04~07",
    note: "확인: variant 4종의 색상·테두리가 서로 구분되는가, size 3단계, 로딩 스피너, Tab 포커스 링.",
    render: () => <ButtonDemo />,
  },
  {
    id: "badge",
    phase: "P2",
    title: "Badge",
    spec: "COMPONENT_SPEC §8.6 · TC-COMP-009-03",
    note: "확인: 5종의 배경·글자 색이 서로 구분되는가 (low=회색, medium=파랑, high=빨강, overdue=연한 빨강).",
    render: () => <BadgeDemo />,
  },
  {
    id: "priority-badge",
    phase: "P2",
    title: "PriorityBadge",
    spec: "COMPONENT_SPEC §5.2 · TC-COMP-013-01~02",
    note: "확인: LOW 회색 / MEDIUM 파랑 / HIGH 빨강, 색뿐 아니라 글자로도 구분되는가.",
    render: () => <PriorityBadgeDemo />,
  },
  {
    id: "overdue-indicator",
    phase: "P2",
    title: "OverdueIndicator",
    spec: "COMPONENT_SPEC §5.3 · TC-COMP-013-03~04",
    note: "확인: 경고 아이콘과 '지연' 텍스트가 함께 보이는가.",
    render: () => <OverdueIndicator />,
  },
  {
    id: "empty-column-state",
    phase: "P2",
    title: "EmptyColumnState",
    spec: "COMPONENT_SPEC §8.4 · TC-COMP-011-01",
    note: "확인: 칼럼 안에서 점선 박스와 안내 문구가 자연스러운가.",
    render: () => <EmptyColumnDemo />,
  },
  {
    id: "board-skeleton",
    phase: "P2",
    title: "BoardSkeleton",
    spec: "COMPONENT_SPEC §8.1 · TC-COMP-011-02",
    note: "확인: 4개 칼럼 모양과 깜빡임, 브라우저 폭을 줄이면 태블릿 2열 · 모바일 1열로 바뀌는가 (TC-COMP-003-08~10과 같은 배치).",
    render: () => <BoardSkeleton />,
  },
  {
    id: "error-banner",
    phase: "P2",
    title: "ErrorBanner",
    spec: "COMPONENT_SPEC §8.2 · TC-COMP-011-03~04",
    note: "확인: 경고 색상, 재시도 버튼 동작(클릭 횟수 증가).",
    render: () => <ErrorBannerDemo />,
  },
  {
    id: "error-toast",
    phase: "P2",
    title: "ErrorToast",
    spec: "COMPONENT_SPEC §8.3 · TC-COMP-012-01~04",
    note: "확인: 하단 중앙에 표시되고 5초 뒤 사라지는가, 표시 중 메시지를 바꾸면 5초가 다시 시작되는가.",
    contained: true,
    render: () => <ErrorToastDemo />,
  },
  {
    id: "modal",
    phase: "P2",
    title: "Modal",
    spec: "COMPONENT_SPEC §8.5 · TC-COMP-009-01~02, 06, 08~11",
    note: "확인: 열리면 입력창에 포커스, Esc·바깥 클릭으로 닫힘, 모달 안 클릭은 안 닫힘, 안쪽 모달에서 Esc는 안쪽만 닫힘, 닫으면 '모달 열기' 버튼으로 포커스 복귀.",
    contained: true,
    render: () => <ModalDemo />,
  },
  {
    id: "confirm-dialog",
    phase: "P2",
    title: "ConfirmDialog",
    spec: "COMPONENT_SPEC §8.7 · TC-COMP-010-01~09, TC-COMP-008-03",
    note: "확인: 열리면 '취소' 버튼에 포커스(Enter를 눌러도 삭제되지 않음), danger는 빨간 확인 버튼, 확인 중 스피너, 실패하면 대화상자가 유지되고 버튼이 다시 활성화.",
    contained: true,
    render: () => <ConfirmDialogDemo />,
  },
];
