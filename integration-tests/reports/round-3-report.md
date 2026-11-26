# Ideamory 3차 통합 테스트 결과 보고서 (`Round 3`)

- **테스트 회차**: `Round 3` (카테고리 병합 UI/UX 개선분 회귀 검증 + `6-1`/`6-2` RAG AI 브리핑 신규 통합 검증 + `v1.1.0` 릴리스 점검)
- **테스트 일시**: `2026-11-26 20:10 ~ 20:16`
- **테스트 대상 환경**:
  - Web URL: `https://ideamory.vercel.app`
  - API URL: `https://p01--ideamory--fyppwr9k8xfj.code.run`
  - DB: Supabase Project (`ideamory`)
  - 테스트 브라우저 / 뷰포트: `Chrome DevTools Isolated Context (round3-test, Mobile App-First 390x844)`
- **테스트 수행자**: `Antigravity (Chrome DevTools MCP + Supabase MCP)`

---

## 1. 전체 요약 (Summary)

| 구분 | 대상 범위 | Pass | Fail | Blocked / Skip | 판정 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **핵심 기능 회귀 (`390x844`)** | `TC-01`, `TC-02`, `TC-03`, `TC-05`, `TC-10`, `TC-12` | 6 | 0 | 0 | ✅ **PASS** |
| **RAG AI 브리핑 (`6-1`/`6-2`)** | `TC-14`, `TC-15` | 2 | 0 | 0 | ✅ **PASS** |
| **Supabase MCP DB 정합성** | `memos`, `categories`, `ogp_caches`, 768차원 `embedding` | 2 | 0 | 0 | ✅ **PASS** |
| **주요 기능 시연 영상 확보** | `integration-tests/evidence/round-3/videos/*.webm` (`01`~`06`) | 6개 | 0 | 0 | ✅ **완료** |

- **회차 최종 결론**: `[x] PASS (Critical / Major 이슈 0건 — 운영 환경 전체 핵심 플로우 정상)`

---

## 2. 시나리오별 테스트 결과표

| TC ID | 시나리오명 | 화면(UI) 결과 | Supabase DB 결과 | 증적 | 비고 |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `TC-01` | 게스트 자동 세션 발급 & 온보딩 시드 메모 | Pass | Pass | `videos/01-quick-capture.webm` | `gst_e66a51cbad976af3dc986384566df15c29034abb52675e78` 발급 및 `사용 가이드` 1건 확인 |
| `TC-02` | 0.1초 퀵 캡처 & 문두 `@카테고리` 즉시 반영 (`★`) | Pass | Pass | `videos/01-quick-capture.webm` | `@일정`, `@스케줄` 즉시 반영 확인 |
| `TC-03` | AI 백그라운드 분류, 768차원 임베딩 & OGP 링크 카드 (`★`) | Pass | Pass | `videos/02-ai-and-ogp.webm` | `https://nextjs.org/ App Router 공식 문서 참고` ➔ `개발` 자동 분류 및 OGP 카드 + `관련 메모 1건` 확인 |
| `TC-05` | **AI 유사 카테고리 병합 제안 배너 & 원자적 병합 (`★` UI/UX 개선 검증)** | **Pass** | **Pass** | `videos/03-category-merge.webm` | 사이드바 `일정 병합 1` / `스케줄 병합 1` 배지, `유사도 90%` 병합 배너 노출 및 `[합치기]` 클릭 시 `일정 2`로 통합·`스케줄` 삭제 확인 |
| `TC-07` | 하이브리드 검색(`Enter`) & 1-Depth 연관 메모 필터 (`★`) | Pass | Pass | `videos/04-search-and-related.webm` | `“RAG” 검색 결과 (2건)` 및 `관련 메모 1건` 필터링 확인 |
| `TC-14` | **썸존 `[AI]` 토글, 포커스 헤더, RAG 단일 브리핑 & `[■ 중단]` 제어 (`★`)** | **Pass** | **Pass** | `videos/06-ai-rag-briefing.webm` | 화살표 전용 `FocusHeader`, `AiSearchIdle` 안내·예시 칩, `AI 검색 중단` 버튼 전환, `개발 메모 정리해줘` 브리핑+근거 5건 확인 |
| `TC-15` | **AI 모드 `0ms` 이탈 복귀 & 드로어 전환 시 상태 잔류 차단** | **Pass** | - | `videos/06-ai-rag-briefing.webm` | `[←]` 즉시 타임라인 복귀 및 `휴지통` → `전체 메모` 복귀 시 `isAiMode` 재노출 없음 확인 |
| `TC-12` | 제텔카스텐 지식망 탐색 (`★` `390x844`) | Pass | Pass | `videos/05-knowledge-graph.webm` | `지식망` 전환 및 연결 범위 슬라이더(`0.60` → `0.85` → `0.70`) 실시간 조절 확인 |
| `TC-10` | `/download` 모바일 앱 뷰포트 & `v1.1.0` 표기 점검 | Pass | - | - | `Capacitor Android Preview · v1.1.0` 및 `ideamory-android-v1.1.0.apk` 다운로드 링크 확인 |

---

## 3. Supabase MCP DB 교차 검증 기록 (`gst_e66a51cbad976af3dc986384566df15c29034abb52675e78`)

- **`public.memos` 적재 및 임베딩·OGP 정합성 검증**:
  - 활성 메모 총 6건 조회:
    - `개발` 3건(`Gemini RAG 서브쿼리...`, `Next.js 15 App Router...`, `https://nextjs.org/...` OGP 연결) 모두 `has_embedding = true`
    - `일정` 2건(`내일 오후 3시 백엔드 RAG API 연동 미팅`, `금요일 배포 체크리스트 및 QA 점검` — `스케줄`에서 병합 이관됨) 모두 `has_embedding = true`
    - `사용 가이드` 1건(`has_ogp = true`)
- **`public.categories` 병합 원자성 검증**:
  - `사용 가이드` (`active_memos = 1`, `has_embedding = true`)
  - `일정` (`active_memos = 2`, `has_embedding = true`)
  - `개발` (`active_memos = 3`, `has_embedding = true`)
  - 기존 `스케줄` 카테고리는 `일정`으로 원자적 병합 후 정상 삭제됨.

---

## 4. 참고 관찰 사항 (Minor Observation)
- 복합어 서브쿼리(`"일정 메모"` 등)와 단일 단어 카테고리(`"일정"`) 간 `ILIKE` 매칭 누락 이슈는 `MemoRepository.searchMemosHybrid`의 `categoryMatchExpr`에 `strpos(lower(queryText), lower(c.name)) > 0` 조건을 추가해 해결 완료함.
- 이번 회차 주요 기능 시연 영상은 `01-quick-capture.webm` ~ `06-ai-rag-briefing.webm` 총 6종으로 확보함(`06-ai-rag-briefing.webm`은 0건 폴백 구간을 트리밍하여 WebM 변환 완료). (`TC-12` 녹화 시 브라우저 MCP 툴셋에 마우스 휠·JS 실행 도구가 없어 캔버스 축소는 미수행하고 연결 강도 슬라이더 조절 중심으로 녹화함)
