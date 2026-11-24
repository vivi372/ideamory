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
    eyebrow: "0.1초 퀵 캡처",
    title: "떠오른 순간, 바로 저장",
    text: "하단 캡처 바에 적고 Enter를 누르면 0.1초 만에 저장되고, 본문을 눌러 고친 뒤 바깥을 누르거나 Enter를 치면 바로 반영돼요.",
  },
  {
    id: "directive",
    number: "02",
    eyebrow: "문두 @ 자동 분류",
    title: "문두 @로 빠르게 분류",
    text: "입력창 맨 앞에 @카테고리를 적으면 본문에서는 빠지고, 카드 상단 배지로 바로 분류돼요.",
  },
  {
    id: "link-preview",
    number: "03",
    eyebrow: "링크 · 공유 캡처",
    title: "링크는 미리보기로 저장",
    text: "복사한 링크를 칩으로 바로 붙여 넣거나 앱에서 공유하면 제목·설명이 담긴 카드로 정리돼요.",
  },
  {
    id: "hybrid-search",
    number: "04",
    eyebrow: "하이브리드 검색 & 관련 메모",
    title: "문맥으로 찾고 연결하기",
    text: "상단 검색바에서 Enter로 문맥 검색을 실행하고, 관련 메모 칩을 누르면 상단 필터 배너로 모아볼 수 있어요.",
  },
  {
    id: "smart-categories",
    number: "05",
    eyebrow: "사이드바 & AI 병합 제안",
    title: "메뉴에서 찾고 한 번에 합치기",
    text: "왼쪽 엣지 스와이프로 사이드바 메뉴를 열어 카테고리를 선택하고, 오렌지 닷이 뜬 병합 제안을 확인하세요.",
  },
  {
    id: "zettelkasten",
    number: "06",
    eyebrow: "제텔카스텐 지식망",
    title: "흩어진 메모가 지식으로 이어지는 지도",
    text: "상단 ‘지식망’ 탭을 누르면 의미가 비슷한 메모들이 자동으로 연결됩니다. 유사도 슬라이더로 연결 강도를 조절하고, 노드를 눌러 바로 읽고 수정하세요.",
  },
] as const;
