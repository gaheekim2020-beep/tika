"use client";

import Link from "next/link";
import { useState } from "react";
import { PreviewSection } from "./_components/PreviewSection";
import { PREVIEW_PHASES, previewSections, type PreviewPhaseId } from "./_registry";

type PhaseFilter = "all" | PreviewPhaseId;

/*
 * 컴포넌트 프리뷰 갤러리 (개발용, npm run dev → http://localhost:3000/preview)
 *
 * - DB·API 없이 목 데이터(`_mock/mockData.ts`)로 개별 컴포넌트를 렌더링한다.
 * - 보여줄 컴포넌트는 `_registry.tsx`의 `previewSections`에 Phase별로 추가한다.
 * - 개발 흐름: Phase 구현 → npm run test 통과 → 여기서 화면 확인 → 다음 Phase (docs/FRONTEND_TASKS.md §1.5)
 */
const PreviewPage = () => {
  const [filter, setFilter] = useState<PhaseFilter>("all");

  const visiblePhases = PREVIEW_PHASES.filter((phase) => filter === "all" || phase.id === filter);

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="flex items-center gap-3">
          <span className="logo">
            <span className="logo-mark" aria-hidden="true">
              T
            </span>
            Tika
          </span>
          <h1 className="text-sm font-semibold text-text-secondary">Component Preview</h1>
        </div>
        <Link href="/" className="btn btn--ghost btn--sm">
          앱으로 돌아가기
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 py-6 md:px-6">
        <p className="mb-4 text-[13px] text-text-secondary">
          개발 중인 컴포넌트를 목 데이터로 확인하는 갤러리입니다. Phase 1(데이터 계층)은 화면이 없어 테스트로만 확인합니다.
        </p>

        <nav aria-label="Phase 필터" className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            className={filter === "all" ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            전체
          </button>
          {PREVIEW_PHASES.map((phase) => (
            <button
              key={phase.id}
              type="button"
              className={filter === phase.id ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
              aria-pressed={filter === phase.id}
              onClick={() => setFilter(phase.id)}
            >
              {phase.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-10">
          {visiblePhases.map((phase) => {
            const sections = previewSections.filter((section) => section.phase === phase.id);

            return (
              <section key={phase.id} aria-labelledby={`phase-${phase.id}`}>
                <h2 id={`phase-${phase.id}`} className="mb-3 text-base font-bold">
                  {`${phase.label} · ${phase.title}`}
                </h2>

                {sections.length === 0 ? (
                  <p className="empty-state">아직 등록된 컴포넌트가 없습니다</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {sections.map((section) => (
                      <PreviewSection
                        key={section.id}
                        title={section.title}
                        spec={section.spec}
                        note={section.note}
                        contained={section.contained}
                      >
                        {section.render()}
                      </PreviewSection>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default PreviewPage;
