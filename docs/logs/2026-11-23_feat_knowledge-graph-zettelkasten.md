# 작업 로그: 4-1. Zero-Effort AI 제텔카스텐 (지식망 모드) 구현

- **작업 일자**: 2026-11-23
- **작업자**: Antigravity Agent
- **대상 브랜치**: `feat/knowledge-graph-zettelkasten` ➔ `develop` (`feat/similarity-tiered-search` 포함)
- **관련 태스크**: `4-1. Zero-Effort AI 제텔카스텐 (지식망 모드) 구현`

---

## 1. 작업 개요 (Summary)
신규 데이터베이스 테이블(`memo_links`)이나 수동 MOC 작성 없이, 기존 Gemini 768차원 임베딩 코사인 유사도 데이터를 100% 재활용하는 **Zero-DB Migration 기반 듀얼 모드(`[캐시] ⇄ [지식망]`)** 및 `react-force-graph-2d` 인터랙티브 지식망을 구현했습니다. 추가로 후속 브랜치(`feat/similarity-tiered-search`)에서 1-Depth 연관 메모 기본 임계값을 `0.75`로 완화하고, 하이브리드 검색에 2계층 랭킹(Tier 1 키워드 최우선 + Tier 2 코사인 유사도 `0.65` 이상 보완)을 적용했습니다.

---

## 2. 주요 구현 상세 (Implementation Details)
- **경량 Canvas 2D 지식망 렌더링 (`apps/web/src/widgets/knowledge-graph/`)**
  - `force-graph-inner.tsx` + `knowledge-graph-canvas.tsx`: `next/dynamic(..., { ssr: false })`로 SSR 크래시를 차단하고, 마운트 즉시 `d3Force('charge', -360)` · `d3Force('link', 175 - ...)` · `warmupTicks={45}`를 적용해 초기 뭉침과 드로어/포커스 전환 시 재가열 떨림을 제거했습니다.
  - `nodePointerAreaPaint`(최소 `18px` 반경)를 추가해 연결선이 없는 고립 노드도 100% 클릭 가능하도록 보완했으며, 줌 배율에 따라 최대 `4줄 × 18자`(유니코드 코드 포인트 안전 슬라이싱) 라벨을 표시합니다.
  - `knowledge-graph-minimap.tsx`: 전체 노드/간선과 현재 뷰포트 사각형을 표시하고 클릭/드래그로 이동할 수 있는 Figma 스타일 미니맵을 구현했습니다.
- **듀얼 모드 UI, 상태 영속화 & 썸존 고정**
  - `view-mode-toggle.tsx`, `use-view-mode-store.ts`, `storage-keys.ts`: `localStorage`(`ideamory_view_mode`, `ideamory_graph_threshold`) 기반 0ms 상태 복원 및 Warm Dark UI에 어울리는 이모지(`🗂️ 캐시` / `🕸️ 지식망`) 토글을 배치했습니다.
  - `page.tsx`, `globals.css`: 지식망 모드에서는 상단 로고·검색바·카테고리 필터를 제거하고 원형 햄버거 버튼과 모드 토글만 플로팅 배치했으며, 하단 반투명 글래스 퀵 캡처 바(`<CaptureInput />`)를 상시 고정했습니다.
  - 휴지통 진입 전 모드를 기억(`returnModeBeforeTrash`)하여 휴지통 뱃지(`×`) 또는 뒤로가기 시 직전 모드(`캐시` 또는 `지식망`)로 복귀합니다.
- **연결도 실시간 제어, 1-Depth 미니 카드 시트 & 네이티브 회전**
  - `graph-toolbar.tsx`: `0.60 ~ 0.85` 유사도 슬라이더(클라이언트 0ms 필터링) 및 연속 탭 시 생각 꼬리물기(`Breadcrumb`)를 제공합니다.
  - `graph-node-sheet.tsx`: 노드 탭 시 150ms 슬라이딩 미니 카드 시트와 `InlineEditor` 인라인 수정, `useSoftDeleteMemo` 0ms 휴지통 이동을 연동했습니다.
  - `MainActivity.java`, `android-bridge.ts`: `OrientationBridge`를 통해 지식망 모드 자동 회전(`SCREEN_ORIENTATION_SENSOR`), 캐시 모드 세로 고정(`SCREEN_ORIENTATION_PORTRAIT`)을 지원합니다.
- **유사도 정책 개편 (`feat/similarity-tiered-search`)**
  - 1-Depth 관련 메모 기본 임계값 `0.80` ➔ `0.75` (`packages/api-spec`, `apps/api`)
  - Gemini 하이브리드 검색 2계층 랭킹(`tierRank` DESC, `finalScore` DESC) 및 기본 임계값 `0.72` ➔ `0.65` 적용

---

## 3. 검증 및 QA 결과 (Verification & QA Results)
- **정적 분석 및 테스트**:
  - `pnpm dlx tsx --test apps/web/src/entities/memo/__tests__/memo-to-graph.test.ts`: **3/3 통과**
  - `pnpm --filter @ideamory/api test`: **103/103 통과**
  - `pnpm turbo typecheck`: **4/4 패키지 통과**
  - `pnpm --filter @ideamory/web lint`: **ESLint 경고/오류 0건**
  - `pnpm --filter @ideamory/web build`: **프로덕션 빌드 성공 (SSR 크래시 0건)**
- **모바일 뷰포트 QA**:
  - `360x640`, `390x844`, `430x932` 해상도에서 가로 스크롤(X-Overflow) 0건 및 썸존 입력란 고정·레이아웃 비겹침 확인.

---

## 4. 특이사항 및 회고 (Notes & Retrospective)
- `packages/db` 스키마 및 마이그레이션 변경 없이(Zero-DB Migration) 기존 768차원 임베딩 코사인 유사도 데이터와 `GET /api/v1/memos/:id/related` 캐시만으로 제텔카스텐 지식망을 구현했습니다.
- 사용자 디자인 피드백을 반영해 모드 전환 토글에는 Warm Dark UI와 어울리는 이모지(`🗂️`, `🕸️`)를 유지했습니다.
