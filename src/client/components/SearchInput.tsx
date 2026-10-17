// 검색은 2차 구현이라 로직·API 없이 비활성 placeholder 입력창만 렌더링한다 (COMPONENT_SPEC §3.3, PRD §3)
export const SearchInput = () => (
  <input
    type="search"
    className="search-input"
    placeholder="검색 (2차 구현 예정)"
    aria-label="검색"
    disabled
  />
);
