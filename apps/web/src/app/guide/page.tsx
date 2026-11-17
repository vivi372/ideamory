import type { Metadata } from "next";
import GuideExperience from "./guide-experience";

export const metadata: Metadata = {
  title: "Ideamory 사용 가이드 — 0.1초 만에 생각 캡처하기",
  description:
    "뇌의 캐시 메모리, 아이디모리를 200% 활용하는 방법을 확인해 보세요.",
};

/**
 * Ideamory 온보딩 사용 가이드 페이지(`/guide`)입니다.
 *
 * @returns 가이드 체험 컴포넌트
 */
export default function GuidePage() {
  return <GuideExperience />;
}
