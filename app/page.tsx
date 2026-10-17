import { BoardContainer } from "@/client/components/BoardContainer";

// 서버 컴포넌트: 클라이언트 컴포넌트 BoardContainer를 렌더링하는 진입점 역할만 한다 (COMPONENT_SPEC §3.1)
export default function Home() {
  return <BoardContainer />;
}
