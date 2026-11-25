# Ideamory 1차 통합 테스트 결과 보고서 (`Round 1`)

- **테스트 회차**: `Round 1`
- **테스트 일시**: `2026-11-25 20:53 ~ 21:08`
- **테스트 대상 환경**:
  - Web URL: `https://ideamory.vercel.app`
  - API URL: `https://p01--ideamory--fyppwr9k8xfj.code.run`
  - DB: Supabase Project (`ideamory`)
  - 테스트 브라우저 / 뷰포트: `Chrome (Mobile App-First 390x844 + 360x640 + 430x932)`
- **테스트 수행자**: `Antigravity + Browser QA Subagent (853621ee) + Supabase MCP`

---

## 1. 전체 요약 (Summary)

| 구분 | 전체 TC 수 | Pass | Fail | Blocked / Skip | 판정 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **화면(UI) & 기능 점검** | 13 | 12 | 1 (`TC-05`) | 0 | ❌ `ISS-01` 수정 후 Round 2 필요 |
| **Supabase MCP DB 정합성** | 11 | 10 | 1 (`TC-05`) | 0 | ❌ `categories.embedding` 누락 확인 |
| **시연 영상 확보** | 5 (`recording*.mp4`) | 6개 파일 보관 | 0 | 0 | ✅ 완료 |

- **회차 최종 결론**: `[ ] PASS` / `[x] FAIL (Major 이슈 1건 `ISS-01` 수정 후 Round 2 재검증 필요)`

---

## 2. 시나리오별 테스트 결과표

| TC ID | 시나리오명 | 화면(UI) 결과 | Supabase DB 결과 | 영상 / 증적 | 비고 / 이슈 ID |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `TC-01` | 게스트 자동 세션 발급 & 온보딩 시드 메모 | Pass | Pass | `videos/recording.mp4` | `/guide` 이동·복귀 및 `게스트 모드` 표기 정상 |
| `TC-02` | 0.1초 퀵 캡처 & 문두 `@카테고리` 즉시 반영 | Pass (참고) | Pass | `videos/recording.mp4` | `@` 무효/초과 입력 시 에러 캡션 대신 silent 정제 (`ISS-02`) |
| `TC-03` | AI 백그라운드 분류, 768차원 임베딩 & OGP 링크 카드 | Pass | Pass | `videos/recording.mp4` | `memos.embedding` 11건 적재 & `ogp_caches` `https://nextjs.org/` N:1 공유(1행) 확인 |
| `TC-04` | 메모 본문 인라인 수정 & 카테고리 변경 시트 (`0ms`) | Pass | Pass | `videos/recording.mp4` | 새로고침 유지 및 `아키텍처` 생성·적용 확인 |
| `TC-05` | AI 유사 카테고리 병합 제안 배너 & 원자적 병합 | **Fail** | **Fail** | `videos/recording.mp4` | `createMemo` 생성 카테고리들의 `categories.embedding IS NULL`로 제안 미발생 (`ISS-01`) |
| `TC-06` | 메모 30일 휴지통 이동 & 원클릭 복구 | Pass | Pass | `videos/recording.mp4` | 빈 카테고리 0ms 숨김, 휴지통 편집 비활성화, 복구 정상 |
| `TC-07` | 하이브리드 검색(`Enter`) & 1-Depth 연관 메모 필터 | Pass | Pass | `videos/recording.mp4` | `캐싱` 검색 1건, `관련 메모 1건` 필터 정상 조회 |
| `TC-08` | 게스트 데이터 전체 초기화(Hard Delete) | Pass | Pass | `videos/recording_4.mp4` | 이전 `gst_7143a693...` `memos 0건`, `categories 0건` 확인 |
| `TC-09` | 소셜 연동(이관), Zero-Profile, 인앱 약관 & 탈퇴 | Pass | Pass | `videos/recording_5.mp4`, `recording_6.mp4` | GitHub 연동 시 게스트 `"사용가이드"` 제외(`guide_cat_count = 0`), `깃허브 연동됨` Zero-Profile 확인, 탈퇴 후 `auth.users`/`memos`/`categories` 모두 `0건` (`ON DELETE CASCADE`) 확인 |
| `TC-10` | 모바일 3종 뷰포트 & `/guide`, `/download` 페이지 점검 | Pass | - | `videos/recording_2.mp4`, `recording_3.mp4` | `360x640`, `390x844`, `430x932` 및 `/download` `v1.0.15` 일치 |
| `TC-11` | 웹뷰 브릿지(Share Intent·뒤로가기) & 오프라인 뷰 | Pass | - | `videos/recording_3.mp4` | `?share_text=...&share_url=...` 썸존 주입 및 URL 정리 확인 |
| `TC-12` | 제텔카스텐 지식망 탐색, OGP 미리보기 & 인라인 편집 | Pass | Pass | `videos/recording.mp4` | `390x844` 연결 범위 슬라이더(`넓게`~`핵심만`) 겹침 없음 |
| `TC-13` | MCP 연동 시트 (API 키 발급·폐기 & 설정 복사) | Pass | Pass | `videos/recording.mp4` | `idm_live_55c2...` 1회 노출/복사 후 폐기 ➔ DB Hard Delete 0건 확인 |

---

## 3. Supabase MCP DB 교차 검증 기록

- **`TC-01 ~ TC-07, TC-12, TC-13` (`gst_7143a693be2a9c4a723524a598efcf1b0cd10982a00cde8d`)**:
  - `memos`: 활성 12건 중 온보딩 시드 제외 11건 모두 `embedding IS NOT NULL` (`has_embedding = true`) 확인.
  - `ogp_caches`: `https://nextjs.org/` 1행만 적재되어 2개 메모가 동일 `ogp_id`(`01a2128f-d8d8-7597-b9c0-a1ab7185f28c`)를 N:1 공유 확인.
  - `categories`: 수동 생성한 `아키텍처`만 `embedding IS NOT NULL`, `@프론트엔드`/`@프론트`/`@백엔드`/`@서버` 등 `createMemo` 생성 카테고리들은 `embedding IS NULL` 확인 (`ISS-01`).
  - `mcp_api_keys`: `idm_live_55c2...` 폐기 후 DB 0건(Hard Delete) 확인.
- **`TC-08` (게스트 초기화)**:
  - `gst_7143a693...` 기준 `old_memos_count = 0`, `old_cats_count = 0` 확인.
- **`TC-09` (GitHub 소셜 이관 & 회원탈퇴 `addff9af-9115-4929-8269-0136f3be879e`)**:
  - 연동 직후: `user_memos_count = 1`, `user_cats_count = 1`, `guide_cat_count = 0` (게스트 `"사용가이드"` 중복 이관 제외 확인).
  - 회원탈퇴 직후: `remaining_users = 0`, `remaining_memos = 0`, `remaining_cats = 0` (`ON DELETE CASCADE` 완전 삭제 확인).

---

## 4. 발견 이슈 및 조치 내역 (Issue Tracker)

| 이슈 ID | 관련 TC | 심각도 | 증상 설명 (UI / DB) | 원인 및 수정 필요 사항 |
| :--- | :---: | :---: | :--- | :--- |
| `ISS-01` | `TC-05` | **Major** | `@프론트엔드`/`@프론트`, `@백엔드`/`@서버` 등 `createMemo`로 생성된 카테고리 간 유사도 병합 제안 배너(`●`)가 뜨지 않음. DB 확인 결과 수동 생성한 `아키텍처`만 `categories.embedding IS NOT NULL`이고 나머지 10개 카테고리는 모두 `NULL`. | `MemoService.generateEmbeddingsInBackground` 또는 `syncCategoryEmbeddingAndDetectSimilar` 경유 카테고리 임베딩 저장 누락 원인 점검 및 수정 필요 |
| `ISS-02` | `TC-02` | Minor | `@🚀테스트이모지`·11자 초과 `@카테고리` 입력 시 `FIELD` 에러 캡션 대신 silent 이모지 제거/10자 절단으로 저장됨. (`@예외 사항`은 첫 공백에서 `@예외` 1토큰으로 파싱) | 의도된 방어 정제 동작인지, 에러 캡션 표출 스펙과 맞출지 결정 필요 |
