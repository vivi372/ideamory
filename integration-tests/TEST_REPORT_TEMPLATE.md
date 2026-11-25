# Ideamory N차 통합 테스트 결과 보고서 (`Round N`)

- **테스트 회차**: `Round N` (예: `1차`)
- **테스트 일시**: `YYYY-MM-DD HH:MM`
- **테스트 대상 환경**:
  - Web URL: `http://localhost:3000` (또는 배포 URL)
  - API URL: `http://localhost:4000` (또는 배포 URL)
  - DB: Supabase Project (`ideamory`)
  - 테스트 브라우저 / 뷰포트: `Chrome (Desktop + Mobile 360x640 / 390x844 / 430x932)`
- **테스트 수행자**: `[이름 또는 에이전트]`

---

## 1. 전체 요약 (Summary)

| 구분 | 전체 TC 수 | Pass | Fail | Blocked / Skip | 판정 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **화면(UI) & 기능 점검** | 13 | 0 | 0 | 0 | ⏳ 대기 |
| **Supabase MCP DB 정합성** | 11 | 0 | 0 | 0 | ⏳ 대기 |
| **README 시연 영상 확보** | 5 | 0 | 0 | 0 | ⏳ 대기 |

- **회차 최종 결론**: `[ ] PASS (이슈 0건, 배포 진행 가능)` / `[ ] FAIL (수정 후 N+1차 재검증 필요)`

---

## 2. 시나리오별 테스트 결과표

| TC ID | 시나리오명 | 화면(UI) 결과 | Supabase DB 결과 | 스크린샷 증적 | 영상 증적 (README용) | 비고 / 이슈 ID |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `TC-01` | 게스트 자동 세션 발급 & 온보딩 시드 메모 | Pass / Fail | Pass / Fail | `screenshots/tc01-*.png` | - | |
| `TC-02` | 0.1초 퀵 캡처 & 문두 `@카테고리` 즉시 반영 | Pass / Fail | Pass / Fail | `screenshots/tc02-*.png` | `videos/01-quick-capture.webm` | |
| `TC-03` | AI 백그라운드 분류, 768차원 임베딩 & OGP 링크 카드 | Pass / Fail | Pass / Fail | `screenshots/tc03-*.png` | `videos/02-ai-and-ogp.webm` | |
| `TC-04` | 메모 본문 인라인 수정 & 카테고리 변경 시트 (`0ms`) | Pass / Fail | Pass / Fail | `screenshots/tc04-*.png` | - | |
| `TC-05` | AI 유사 카테고리 병합 제안 배너 & 원자적 병합 | Pass / Fail | Pass / Fail | `screenshots/tc05-*.png` | `videos/03-category-merge.webm` | |
| `TC-06` | 메모 30일 휴지통 이동 & 원클릭 복구 | Pass / Fail | Pass / Fail | `screenshots/tc06-*.png` | - | |
| `TC-07` | 하이브리드 검색(`Enter`) & 1-Depth 연관 메모 필터 | Pass / Fail | Pass / Fail | `screenshots/tc07-*.png` | `videos/04-search-and-related.webm` | |
| `TC-08` | 게스트 데이터 전체 초기화(Hard Delete) | Pass / Fail | Pass / Fail | `screenshots/tc08-*.png` | - | |
| `TC-09` | 소셜 연동(이관), Zero-Profile, 인앱 약관 & 탈퇴 | Pass / Fail | Pass / Fail | `screenshots/tc09-*.png` | - | |
| `TC-10` | 모바일 3종 뷰포트 & `/guide`, `/download` 페이지 점검 | Pass / Fail | - | `screenshots/tc10-*.png` | - | |
| `TC-11` | 웹뷰 브릿지(Share Intent·뒤로가기) & 오프라인 뷰 | Pass / Fail | - | `screenshots/tc11-*.png` | - | |
| `TC-12` | 제텔카스텐 지식망 탐색, OGP 미리보기 & 인라인 편집 | Pass / Fail | Pass / Fail | `screenshots/tc12-*.png` | `videos/05-knowledge-graph.webm` | |
| `TC-13` | MCP 연동 시트 (API 키 발급·폐기 & 설정 복사) | Pass / Fail | Pass / Fail | `screenshots/tc13-*.png` | - | |

---

## 3. Supabase MCP DB 교차 검증 기록

> 각 시나리오 실행 직후 Supabase MCP `execute_sql`로 조회한 핵심 결과 요약을 기록합니다.

- **`TC-01 ~ TC-03` (세션 · 메모 · 임베딩 · OGP)**:
  - 조회 건수 / 주요 값 확인: `예) memos.embedding IS NOT NULL 확인, ogp_caches 14일 TTL 적재 확인`
- **`TC-04 ~ TC-06` (카테고리 병합 · 휴지통)**:
  - 조회 건수 / 주요 값 확인: `예) 병합 후 source category 삭제 및 CASCADE로 제안 큐 소멸 확인`
- **`TC-08 ~ TC-09` (게스트 초기화 · 이관 · 탈퇴)**:
  - 조회 건수 / 주요 값 확인: `예) 초기화/탈퇴 후 잔여 고아 레코드 0건 확인`

---

## 4. 발견 이슈 및 조치 내역 (Issue Tracker)

| 이슈 ID | 관련 TC | 심각도 | 증상 설명 (UI / DB) | 원인 및 수정 내역 (파일/커밋) | 다음 회차 재검증 여부 |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `ISS-01` | `TC-XX` | Major | 예) ... | 예) ... | [ ] |

---

## 5. GitHub README 첨부용 영상 체크리스트

- [ ] `videos/01-quick-capture.webm`: 0.1초 퀵 캡처 + `@카테고리` 하이라이트 + 즉시 타임라인 반영 (10~15초 내외)
- [ ] `videos/02-ai-and-ogp.webm`: URL 포함 메모 입력 후 AI 자동 분류 및 OGP 카드 자동 전환
- [ ] `videos/03-category-merge.webm`: 유사 카테고리 병합 제안 배너 노출 및 원클릭 병합
- [ ] `videos/04-search-and-related.webm`: 자연어/키워드 하이브리드 검색 + 연관 메모 칩 필터 전환
- [ ] `videos/05-knowledge-graph.webm`: 제텔카스텐 지식망 연결 범위 슬라이더·노드 탐색 및 미니 시트 인라인 편집
