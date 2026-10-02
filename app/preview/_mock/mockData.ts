import type { BoardData, TicketWithMeta } from "@/shared/types";

/*
 * 프리뷰 갤러리용 목 데이터 — DB·API 없이 컴포넌트를 렌더링하기 위한 고정 값.
 * 서버 렌더링과 클라이언트 렌더링 결과가 달라지지 않도록 현재 시각이나 카운터를 쓰지 않는다.
 * 값의 모양은 docs/DATA_MODEL.md §6 시드 예시와 docs/reference/mockup.html을 따른다.
 */

const CREATED_AT = new Date("2026-09-20T09:00:00.000Z");

export const makeTicket = (overrides: Partial<TicketWithMeta> = {}): TicketWithMeta => ({
  id: 1,
  title: "샘플 티켓",
  description: null,
  status: "BACKLOG",
  priority: "MEDIUM",
  position: 1024,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  isOverdue: false,
  ...overrides,
});

/** 제목이 200자인 티켓 — 말줄임 처리 확인용 (TC-COMP-001-07) */
export const longTitleTicket: TicketWithMeta = makeTicket({
  id: 99,
  title: "아주 긴 제목 ".repeat(40).slice(0, 200),
  description: "제목이 카드 폭을 넘을 때 말줄임으로 처리되는지 확인하는 티켓입니다.",
  priority: "HIGH",
  dueDate: "2026-10-20",
});

/** 4개 칼럼에 지연·정상·완료 카드가 고르게 들어 있는 기본 보드 */
export const makeBoard = (): BoardData => ({
  BACKLOG: [
    makeTicket({
      id: 1,
      title: "알림 기능 조사",
      description: "푸시 알림과 이메일 알림 중 무엇을 먼저 지원할지 비교한다.",
      priority: "LOW",
      position: 1024,
    }),
    makeTicket({ id: 2, title: "성능 테스트 계획", priority: "MEDIUM", position: 2048 }),
    makeTicket({ id: 3, title: "CI/CD 파이프라인 구축", priority: "LOW", position: 3072 }),
  ],
  TODO: [
    makeTicket({
      id: 4,
      title: "대시보드 레이아웃",
      description: "칸반 보드 상단 요약 영역 레이아웃을 정한다.",
      status: "TODO",
      priority: "MEDIUM",
      position: 1024,
      dueDate: "2026-09-03",
      startedAt: new Date("2026-08-28T09:00:00.000Z"),
      isOverdue: true,
    }),
    makeTicket({
      id: 5,
      title: "로그인 페이지 구현",
      status: "TODO",
      priority: "HIGH",
      position: 2048,
      dueDate: "2026-10-20",
      startedAt: new Date("2026-09-25T09:00:00.000Z"),
    }),
  ],
  IN_PROGRESS: [
    makeTicket({
      id: 6,
      title: "API 설계 문서 작성",
      status: "IN_PROGRESS",
      priority: "HIGH",
      position: 1024,
      dueDate: "2026-09-01",
      startedAt: new Date("2026-08-25T09:00:00.000Z"),
      isOverdue: true,
    }),
    makeTicket({
      id: 7,
      title: "DB 스키마 설계",
      description: "tickets 테이블과 인덱스를 정리한다.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      position: 2048,
      dueDate: "2026-10-10",
      startedAt: new Date("2026-09-28T09:00:00.000Z"),
    }),
  ],
  DONE: [
    makeTicket({
      id: 8,
      title: "프로젝트 요구사항 정리",
      status: "DONE",
      priority: "HIGH",
      position: 1024,
      dueDate: "2026-09-02",
      startedAt: new Date("2026-08-20T09:00:00.000Z"),
      completedAt: new Date("2026-09-01T09:00:00.000Z"),
    }),
    makeTicket({
      id: 9,
      title: "UI 와이어프레임 작성",
      status: "DONE",
      priority: "MEDIUM",
      position: 2048,
      dueDate: "2026-09-03",
      startedAt: new Date("2026-08-22T09:00:00.000Z"),
      completedAt: new Date("2026-09-02T09:00:00.000Z"),
    }),
  ],
});

/** 빈 칼럼 표시(EmptyColumnState)와 첫 카드 드롭 확인용 */
export const makeEmptyBoard = (): BoardData => ({
  BACKLOG: [],
  TODO: [],
  IN_PROGRESS: [],
  DONE: [],
});
