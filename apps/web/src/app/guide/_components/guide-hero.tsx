"use client";

import { useState } from "react";
import { ArrowDown, Check, Plus, Trash2 } from "lucide-react";

/**
 * `/guide` 페이지 상단 Hero 섹션 컴포넌트입니다.
 * 실제 Ideamory 메모 카드(`.note-card`)와 하단 퀵 캡처 바(`.capture-box`) 구조를
 * 동일하게 재현한 인터랙티브 데모를 제공합니다.
 *
 * @returns Hero 섹션 JSX 엘리먼트
 */
export function GuideHero() {
  const [draft, setDraft] = useState("다음 주 회의 안건에 넣을 것");
  const [memoText, setMemoText] = useState("다음 주 회의 안건에 넣을 것");
  const [saved, setSaved] = useState(false);

  const handleSaveDemo = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setMemoText(trimmed);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="guide-hero" aria-labelledby="guide-title">
      <div className="guide-kicker">
        <span className="guide-kicker-dot" /> YOUR MEMORY CACHE
      </div>
      <h1 id="guide-title">
        생각은 가볍게 담고,
        <br />
        <span>의미는 자연스럽게 이어져요.</span>
      </h1>
      <p className="guide-lede">
        정리보다 먼저 기록하세요.
        <br />
        Ideamory가 당신의 생각을 기억하고 연결합니다.
      </p>
      <div className="guide-hero-demo">
        <div className="hero-demo-top">
          <span className="demo-live-dot" /> 퀵 캡처 미리보기 <span>00:00.1</span>
        </div>

        <div className={`note-card guide-note-preview ${saved ? "is-saved" : ""}`}>
          <div className="note-meta">
            <time>방금 전</time>
            <div className="note-meta-actions">
              <span className="category-label">아이디어</span>
              <span className="guide-trash-icon" aria-hidden="true">
                {saved ? <Check size={13} /> : <Trash2 size={13} />}
              </span>
            </div>
          </div>
          <div className="note-copy">{memoText}</div>
        </div>

        <div className="capture-box guide-capture-mock">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSaveDemo();
              }
            }}
            placeholder="지금 떠오른 생각을 기록하세요..."
            aria-label="퀵 캡처 미리보기 입력"
          />
          <button
            type="button"
            className="save-button shrink-0"
            onClick={handleSaveDemo}
            aria-label="빠르게 메모 저장 체험"
          >
            {draft.trim() ? <Check size={17} /> : <Plus size={18} />}
          </button>
        </div>

        <span className="hero-demo-caption">
          적고, Enter로 저장하고, 다시 생각으로 돌아가기
        </span>
      </div>
      <a className="guide-scroll-link" href="#guide-features">
        30초 안에 둘러보기 <ArrowDown size={14} />
      </a>
    </section>
  );
}
