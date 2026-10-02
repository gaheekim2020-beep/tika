import type { ReactNode } from "react";

interface PreviewSectionProps {
  title: string;
  /** 관련 명세·TC 번호 */
  spec?: string;
  note?: string;
  /** 모달·토스트처럼 화면 전체(`position: fixed`)를 덮는 컴포넌트를 이 패널 안에 가둔다 */
  contained?: boolean;
  children: ReactNode;
}

export const PreviewSection = ({ title, spec, note, contained = false, children }: PreviewSectionProps) => (
  <article className="rounded-xl border border-border-default bg-bg-surface">
    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-default px-4 py-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {spec ? <span className="font-mono text-xs text-text-secondary">{spec}</span> : null}
    </header>
    {note ? <p className="px-4 pt-3 text-xs text-text-secondary">{note}</p> : null}
    {/* transform이 있으면 자손의 position: fixed가 화면이 아닌 이 패널을 기준으로 배치된다 */}
    <div className={contained ? "relative min-h-[520px] transform-gpu overflow-hidden p-4" : "p-4"}>
      {children}
    </div>
  </article>
);
