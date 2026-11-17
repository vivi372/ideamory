/**
 * `/guide` 페이지의 5대 핵심 기능 섹션 정적 메타데이터입니다.
 */
export interface GuideFeatureMeta {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  text: string;
}

export const GUIDE_FEATURES: readonly GuideFeatureMeta[] = [
  {
    id: "quick-capture",
    number: "01",
    eyebrow: "CAPTURE IN A MOMENT",
    title: "떠오른 순간, 바로 저장",
    text: "정리할 필요 없이 생각나는 그대로 적어두세요. 0.1초면 기록이 끝나요.",
  },
  {
    id: "directive",
    number: "02",
    eyebrow: "DIRECTIVE FIRST",
    title: "문두 @로 빠르게 분류",
    text: "문장 앞에 @카테고리를 붙이면 본문에서는 빠지고, 메모가 바로 분류돼요.",
  },
  {
    id: "link-preview",
    number: "03",
    eyebrow: "LINK, READY TO RETURN",
    title: "링크는 미리보기로 저장",
    text: "링크를 붙여 넣으면 제목과 설명을 함께 담아 나중에 다시 찾기 쉬워져요.",
  },
  {
    id: "hybrid-search",
    number: "04",
    eyebrow: "MEANING OVER EXACT WORDS",
    title: "문맥으로 찾고 연결하기",
    text: "정확한 단어가 기억나지 않아도 의미가 가까운 메모와 관련 기록을 발견해요.",
  },
  {
    id: "smart-categories",
    number: "05",
    eyebrow: "LESS CLUTTER, BETTER CONTEXT",
    title: "카테고리는 알아서 정리",
    text: "비어 있는 카테고리는 숨기고, 겹치는 분류는 한 번에 정돈할 수 있어요.",
  },
] as const;
