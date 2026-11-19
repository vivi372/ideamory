"use client";

export interface RelatedMemosChipProps {
  /** 코사인 유사도 0.8 이상 연관 메모 개수 (1건 이상일 때만 렌더링) */
  count: number;
  /** 현재 활성화된 연관 필터 기준 메모인지 여부 */
  isActive?: boolean;
  /** 칩 클릭 시 1-Depth 연관 메모 필터를 활성화하는 콜백 */
  onSelect: () => void;
}

/**
 * 메모 카드 하단에 배치되어 코사인 유사도 0.8 이상의 연관 메모를
 * 별도 페이지 이동 없이 1-Depth 라이브 필터링으로 모아보는 칩 버튼입니다.
 *
 * 연관 메모가 0건일 때는 화면에 렌더링하지 않아 불필요한 시각적 노이즈를 방지합니다.
 *
 * @param props 연관 메모 개수, 활성 상태 및 클릭 콜백
 * @returns 관련 메모 칩 JSX (0건이면 null)
 */
export function RelatedMemosChip({
  count,
  isActive = false,
  onSelect,
}: RelatedMemosChipProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="related-row">
      <button
        type="button"
        className="related-chip related-count-chip"
        onClick={onSelect}
        aria-pressed={isActive}
      >
        <span className="related-dot" aria-hidden="true" />
        <span>관련 메모 {count}건</span>
      </button>
    </div>
  );
}
