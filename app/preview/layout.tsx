import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tika Component Preview",
  robots: { index: false, follow: false },
};

interface PreviewLayoutProps {
  children: ReactNode;
}

const PreviewLayout = ({ children }: PreviewLayoutProps) => {
  // 개발용 갤러리라 프로덕션 빌드(Vercel 배포 포함)에서는 404로 처리해 노출하지 않는다
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <>{children}</>;
};

export default PreviewLayout;
