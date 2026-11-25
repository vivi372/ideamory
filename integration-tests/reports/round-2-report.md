# Ideamory 2차 통합 테스트 결과 보고서 (`Round 2`)

- **테스트 회차**: `Round 2` (`ISS-01` 수정 후 재검증 및 모바일 앱 사이즈 PNG 증적 확보)
- **테스트 일시**: `2026-11-25 21:49 ~ 21:57`
- **테스트 대상 환경**:
  - Web URL: `https://ideamory.vercel.app`
  - API URL: `https://p01--ideamory--fyppwr9k8xfj.code.run`
  - DB: Supabase Project (`ideamory`)
  - 테스트 브라우저 / 뷰포트: `Chrome DevTools Isolated Context (round2-qa, Mobile App-First 390x844 @2x touch)`
- **테스트 수행자**: `Antigravity (Chrome DevTools MCP + Supabase MCP)`

---

## 1. 전체 요약 (Summary)

| 구분 | 대상 범위 | Pass | Fail | Blocked / Skip | 판정 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`ISS-01` 재검증 (`TC-05`)** | 카테고리 임베딩 영속화 & AI 병합 제안·원자적 병합 | 1 | 0 | 0 | ✅ **해결 확인** |
| **핵심 회귀 점검 (`390x844` 앱 사이즈)** | `TC-01`, `TC-02`, `TC-03`, `TC-07`, `TC-10`, `TC-12`, `TC-13` | 7 | 0 | 0 | ✅ **PASS** |
| **Supabase MCP DB 정합성** | `categories.embedding`, `category_merge_suggestions`, `memos.embedding` | 3 | 0 | 0 | ✅ **PASS** |
| **PNG 스크린샷 증적 확보** | `integration-tests/evidence/round-2/screenshots/*.png` | 9장 | 0 | 0 | ✅ **완료** |
| **README 시연 영상 확보** | `integration-tests/evidence/round-2/videos/*.webm` (`★`) | 5개 | 0 | 0 | ✅ **완료** |

- **회차 최종 결론**: `[x] PASS (Major 이슈 0건 — ISS-01 완전 해결 확인)`

---

## 2. 시나리오별 테스트 결과표

| TC ID | 시나리오명 | 화면(UI) 결과 | Supabase DB 결과 | 스크린샷 증적 (`390x844`) | 비고 |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `TC-01` | 게스트 자동 세션 발급 & 온보딩 시드 메모 | Pass | Pass | `screenshots/tc01-onboarding-and-capture.png` | `gst_571093e792dce1b7fdac2e30f199580251c2363100e7129f` 자동 발급 확인 |
| `TC-02` | 0.1초 퀵 캡처 & 문두 `@카테고리` 즉시 반영 | Pass | Pass | `screenshots/tc01-onboarding-and-capture.png` | `@프론트엔드`, `@프론트`, `@일정`, `@스케줄` 즉시 반영 |
| `TC-03` | AI 백그라운드 분류, 768차원 임베딩 & OGP 링크 카드 | Pass | Pass | `screenshots/tc03-ai-classify-and-ogp.png` | `NestJS와 PostgreSQL pgvector...` ➔ `백엔드` 자동 분류, `https://nextjs.org/` OGP 카드 자동 전환 |
| `TC-05` | **AI 유사 카테고리 병합 제안 배너 & 원자적 병합 (`ISS-01` 재검증)** | **Pass** | **Pass** | `screenshots/tc05-sidebar-badge.png`, `tc05-merge-suggestion.png`, `tc05-after-merge.png` | `일정` vs `스케줄` 코사인 유사도 `0.9038` (`90%`) ➔ 병합 제안 배너 노출 및 `[합치기]` 클릭 시 `일정 2`로 통합·`스케줄` 삭제 확인 |
| `TC-07` | 하이브리드 검색(`Enter`) | Pass | Pass | `screenshots/tc07-search.png` | `“캐싱” 검색 결과 (1건)` 정상 노출 |
| `TC-10` | `/download` 모바일 앱 뷰포트 점검 | Pass | - | `screenshots/tc10-download.png` | `390x844` 레이아웃 정상 및 `v1.0.15` 표기 일치 |
| `TC-12` | 제텔카스텐 지식망 탐색 (`390x844`) | Pass | Pass | `screenshots/tc12-knowledge-graph.png` | 연결 범위 슬라이더 및 그래프 캔버스 정상 렌더링 |
| `TC-13` | MCP 연동 시트 (`390x844`) | Pass | - | `screenshots/tc13-mcp-sheet.png` | 게스트 모드 키 생성 버튼 비활성화 및 시트 레이아웃 정상 |

---

## 3. Supabase MCP DB 교차 검증 기록 (`gst_571093e792dce1b7fdac2e30f199580251c2363100e7129f`)

- **`categories.embedding IS NOT NULL` 검증 (`ISS-01` 수정 확인)**:
  - `사용 가이드`, `프론트엔드`, `프론트`, `백엔드`, `일정`, `스케줄` 등 `createMemo`·AI 분류·시드 경로로 생성된 **모든 카테고리**에서 `has_embedding = true` 확인.
  - 참고: `프론트엔드` ↔ `프론트`의 코사인 유사도는 `0.8293`으로 임계값(`0.85`) 미만이었으며, `일정` ↔ `스케줄`은 `0.9038`로 임계값을 초과하여 `category_merge_suggestions`에 정상 적재됨.
- **`TC-05` 원자적 병합 직후 정합성**:
  - `일정` 카테고리 소속 메모 `2건`으로 통합, `스케줄` 카테고리 삭제 확인.
  - `category_merge_suggestions` 잔여 건수 `0건` (`ON DELETE CASCADE` 정리) 확인.
- **`memos.embedding` 적재**:
  - 활성 메모 `6건` 중 온보딩 시드 제외 신규 작성 `5건` 모두 `embedding IS NOT NULL` (`embedded_memos = 5`) 확인.

---

## 4. Round 1 이슈 종결 현황

| 이슈 ID | 관련 TC | 심각도 | Round 2 재검증 결과 |
| :--- | :---: | :---: | :--- |
| `ISS-01` | `TC-05` | Major | ✅ **Closed** — PR #42 배포 후 프로덕션 DB `categories.embedding` 전수 저장 및 `90%` 병합 제안 배너·원자적 병합 정상 동작 확인 |
| `ISS-02` | `TC-02` | Minor | 참고 유지 — Silent 정제 정책 유지 여부 추후 판단 |
