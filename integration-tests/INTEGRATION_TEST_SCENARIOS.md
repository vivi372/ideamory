# Ideamory 통합 테스트 시나리오 (UI + Supabase MCP DB)

> **목적**: 실제 브라우저 화면 동작과 Supabase PostgreSQL DB 적재 값을 교차 검증하고, GitHub README용 시연 영상 및 스크린샷 증적을 확보합니다.  
> **참고**: 백엔드 단위/API 계약/로깅 검증은 `pnpm --filter @ideamory/api test`로 갈음합니다.

---

## Group A. 익명 게스트 부트스트랩 & 온보딩

### `TC-01`: 최초 진입 게스트 자동 세션 발급 & 온보딩 시드 메모
- **사전 조건**: 브라우저 `localStorage` / 쿠키가 비어 있는 신규 세션 상태
- **화면 수행 절차**:
  1. 메인 페이지(`/`)에 접속합니다.
  2. 상단 햄버거 메뉴(또는 좌측 스와이프)로 사이드바 드로어를 엽니다.
- **기대 결과 (UI)**:
  - 별도 로그인 화면 없이 0.1초 내 메인 타임라인이 렌더링됩니다.
  - 온보딩 시드 메모(`/guide` OGP 카드 포함) 1건이 타임라인에 표시되고, OGP 카드 클릭 시 앱 내부 `/guide` 페이지로 이동합니다.
  - 사이드바 드로어 하단에 `게스트 모드` 상태가 표시됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, guest_token, category_id, ogp_id, left(content, 40) AS preview, deleted_at, created_at
  FROM memos
  WHERE guest_token = '<발급된_guest_token>'
  ORDER BY created_at DESC;
  ```
  - `memos`에 시드 메모 1건, `categories`에 해당 카테고리 1건, `ogp_caches`에 `/guide` OGP가 정상 연결(`ogp_id IS NOT NULL`)되어 있어야 합니다.
- **증적**: `screenshots/tc01-onboarding-and-drawer.png`

---

## Group B. 0.1초 퀵 캡처 & AI / OGP 백그라운드 파이프라인

### `TC-02`: 0.1초 퀵 캡처 & 문두 `@카테고리` 즉시 반영 ★ README 영상 녹화
- **사전 조건**: 메인 타임라인 활성 상태
- **화면 수행 절차**:
  1. 하단 썸존 입력란에 `@개발 리팩토링 체크리스트 정리하기`를 입력합니다. (`@개발` 하이라이트 확인)
  2. `Enter`(PC) 또는 우측 `+` 전송 버튼을 누릅니다.
  3. 10자 초과 또는 이모지 포함 `@🚀테스트` 등 예외 입력 시 `FIELD` 에러 캡션 노출 여부도 확인합니다.
- **기대 결과 (UI)**:
  - 전송 즉시 대기 스피너 없이 0.1초 내 타임라인 최상단에 `개발` 카테고리 배지가 달린 메모 카드가 나타납니다.
  - 본문에서는 `@개발` 지시어가 제거된 `리팩토링 체크리스트 정리하기`만 표시됩니다.
  - 사이드바 `LIBRARY`의 `개발` 카테고리 카운트가 즉시 `+1` 됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT m.id, m.content, c.name AS category_name, c.normalized_name, (m.embedding IS NOT NULL) AS has_embedding
  FROM memos m
  JOIN categories c ON m.category_id = c.id
  WHERE m.guest_token = '<guest_token>'
  ORDER BY m.created_at DESC
  LIMIT 3;
  ```
  - `content`에서 `@개발`이 제거되어 있고, `c.name = '개발'`, `c.normalized_name = '개발'`, 잠시 후 `has_embedding = true`가 되어야 합니다.
- **증적**:
  - 스크린샷: `screenshots/tc02-quick-capture.png`
  - ★ README 영상: `videos/01-quick-capture.webm`

### `TC-03`: AI 백그라운드 자동 분류, 768차원 임베딩 & OGP 링크 카드 ★ README 영상 녹화
- **사전 조건**: 메인 타임라인 활성 상태
- **화면 수행 절차**:
  1. 하단 입력란에 카테고리 지시어 없이 URL 포함 메모를 입력 후 전송합니다.
     예: `넥스트 공식 문서 App Router 캐싱 전략 정리 https://nextjs.org`
  2. 스켈레톤/미분류 상태에서 백그라운드 폴링(최대 3~5초) 후 카드 변화를 관찰합니다.
- **기대 결과 (UI)**:
  - 0.1초 내 `미분류` 배지 + OGP 스켈레톤 상태로 카드가 선렌더링됩니다.
  - 몇 초 뒤 새로고침 없이 자동으로 AI가 추천한 카테고리명으로 배지가 바뀌고, `nextjs.org` OGP 미리보기 카드(제목/설명/썸네일)로 자동 전환됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT m.id, c.name AS ai_category, (m.embedding IS NOT NULL) AS has_memo_vec,
         o.target_url, o.title AS ogp_title, o.expires_at
  FROM memos m
  JOIN categories c ON m.category_id = c.id
  LEFT JOIN ogp_caches o ON m.ogp_id = o.id
  WHERE m.guest_token = '<guest_token>'
  ORDER BY m.created_at DESC
  LIMIT 1;
  ```
  - `ai_category <> '미분류'`, `has_memo_vec = true`, `o.target_url` 및 `o.expires_at`(14일 TTL)이 적재되어 있어야 합니다.
- **증적**:
  - 스크린샷: `screenshots/tc03-ai-ogp-enriched.png`
  - ★ README 영상: `videos/02-ai-and-ogp.webm`

---

## Group C. 인라인 편집, 카테고리 병합 & 30일 휴지통

### `TC-04`: 메모 본문 인라인 수정 & 0ms 카테고리 변경 시트
- **사전 조건**: 타임라인에 메모 2건 이상 존재
- **화면 수행 절차**:
  1. 메모 카드 본문을 클릭해 인라인 편집 모드로 진입한 뒤 내용을 수정하고 저장합니다.
  2. 메모 카드 우측 상단 카테고리 배지를 클릭해 카테고리 바텀시트를 엽니다.
  3. 검색창에 기존 카테고리 일부를 입력해 `0ms` 필터링을 확인하고, 새 카테고리(예: `아키텍처`)를 생성 및 적용합니다.
- **기대 결과 (UI)**:
  - 본문 수정 즉시 화면에 반영되고 새로고침 후에도 유지됩니다.
  - 카테고리 변경 시트에서 즉각 필터링되며, 새 카테고리 적용 시 카드 배지와 사이드바 카운트가 즉시 동기화됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT m.id, m.content, m.updated_at, c.name AS category_name
  FROM memos m
  JOIN categories c ON m.category_id = c.id
  WHERE m.id = '<수정한_memo_id>';
  ```
  - 수정된 `content`, 갱신된 `updated_at`, 변경된 `category_name`이 일치해야 합니다.
- **증적**: `screenshots/tc04-inline-edit-and-picker.png`

### `TC-05`: AI 유사 카테고리 병합 제안 & 원클릭 원자적 병합 ★ README 영상 녹화
- **사전 조건**: 의미론적으로 유사한 카테고리 2개 생성 (예: `@프론트엔드 리액트 훅 정리` ➔ 잠시 후 `@프론트 UI 컴포넌트 패턴`)
- **화면 수행 절차**:
  1. 사이드바 드로어를 열어 유사 카테고리 옆 앰버/오렌지 닷(`●`) 표시를 확인합니다.
  2. 해당 카테고리를 선택해 상단에 노출되는 `MergeSuggestionBanner`(`'{대상}' 카테고리와 비슷해요. 하나로 합칠까요?`)를 확인합니다.
  3. `[합치기]` 버튼을 클릭합니다.
- **기대 결과 (UI)**:
  - 병합 즉시 대상 카테고리 뷰로 전환되며 두 카테고리의 메모가 하나로 통합됩니다.
  - 사이드바에서 원본 카테고리가 사라지고 대상 카테고리의 `memoCount`가 합산됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, name FROM categories WHERE guest_token = '<guest_token>';
  SELECT * FROM category_merge_suggestions WHERE source_category_id = '<원본_id>' OR target_category_id = '<원본_id>';
  ```
  - 원본 카테고리가 삭제되고, `ON DELETE CASCADE`로 병합 제안 큐 레코드도 0건으로 정리되어야 합니다.
- **증적**:
  - 스크린샷: `screenshots/tc05-category-merge.png`
  - ★ README 영상: `videos/03-category-merge.webm`

### `TC-06`: 메모 30일 휴지통 이동 & 원클릭 복구
- **사전 조건**: 활성 메모 1건 이상 존재
- **화면 수행 절차**:
  1. 메모 카드 우측 상단 휴지통 아이콘을 눌러 삭제(Soft Delete)합니다.
  2. 사이드바 드로어 ➔ `휴지통`으로 이동해 삭제된 메모가 보관되어 있는지 확인합니다.
  3. `[복구]` 버튼을 눌러 활성 타임라인으로 복구합니다.
- **기대 결과 (UI)**:
  - 삭제 시 타임라인에서 즉시 사라지고 `휴지통`에 표시되며(인라인 편집/카테고리 변경 비활성화), 복구 시 원래 카테고리로 즉시 복귀합니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, deleted_at FROM memos WHERE id = '<대상_memo_id>';
  ```
  - 삭제 직후 `deleted_at IS NOT NULL`, 복구 직후 `deleted_at IS NULL`이어야 합니다.
- **증적**: `screenshots/tc06-trash-and-restore.png`

---

## Group D. 하이브리드 검색 & 1-Depth 연관 메모

### `TC-07`: 하이브리드 검색(`Enter`) & 1-Depth 연관 메모 필터 ★ README 영상 녹화
- **사전 조건**: 서로 주제가 유사한 메모 2건 이상 (예: `Next.js 캐싱 전략`, `React 서버 컴포넌트 렌더링`) 및 임베딩 생성 완료 상태
- **화면 수행 절차**:
  1. 상단 검색바에 한국어/영문 질의어를 입력할 때 타이핑 도중에는 API가 호출되지 않는지 확인한 뒤 `[Enter]`를 누릅니다.
  2. 검색 결과 배너(`"..." 검색 결과 N건`) 확인 후 `[✕]`로 전체 타임라인에 복귀합니다.
  3. 메모 카드 하단의 `관련 메모 N건` 칩을 클릭해 1-Depth 연관 메모 필터 뷰로 전환하고, 상단 배너에서 해제합니다.
- **기대 결과 (UI)**:
  - 키워드가 정확히 일치하지 않아도 의미론적으로 유사한 메모가 검색 결과에 노출됩니다.
  - 연관 메모 칩 클릭 시 기준 메모 + 유사도 `0.8` 이상 메모 목록으로 즉시 필터링됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, left(content, 30) AS preview, (embedding IS NOT NULL) AS has_embedding
  FROM memos
  WHERE guest_token = '<guest_token>' AND deleted_at IS NULL;
  ```
  - 검색 및 연관 추천 대상 활성 메모들의 `embedding` 벡터가 모두 생성되어 있는지 확인합니다.
- **증적**:
  - 스크린샷: `screenshots/tc07-search-and-related.png`
  - ★ README 영상: `videos/04-search-and-related.webm`

---

## Group E. 게스트 초기화 & 소셜 회원 라이프사이클

### `TC-08`: 게스트 데이터 전체 초기화 (Hard Delete)
- **사전 조건**: 게스트 세션에 메모/카테고리 2건 이상 존재
- **화면 수행 절차**:
  1. 사이드바 드로어 하단 `데이터 초기화` 버튼 클릭 ➔ 확인 모달에서 최종 승인합니다.
- **기대 결과 (UI)**:
  - 기존 게스트 메모가 모두 제거되고 초기 온보딩 상태(새 세션 또는 빈 상태)로 리셋됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT COUNT(*) AS remaining_memos FROM memos WHERE guest_token = '<이전_guest_token>';
  SELECT COUNT(*) AS remaining_cats FROM categories WHERE guest_token = '<이전_guest_token>';
  ```
  - 두 카운트 모두 `0`이어야 합니다 (고아 레코드 0건).
- **증적**: `screenshots/tc08-guest-reset.png`

### `TC-09`: 소셜 계정 연동(게스트 데이터 이관) & 회원탈퇴
- **사전 조건**: 게스트 세션에 테스트 메모 1건 이상 작성된 상태
- **화면 수행 절차**:
  1. 사이드바 드로어 하단 `계정 연동하기` ➔ Google/GitHub 소셜 로그인(또는 테스트 환경 OAuth 콜백)을 진행합니다.
  2. 로그인 완료 후 기존 게스트 메모가 그대로 유지되는지 확인합니다.
  3. 사이드바 하단 `회원탈퇴` 진행 후 확인 모달을 승인합니다.
- **기대 결과 (UI)**:
  - 소셜 연동 직후 기존 게스트 메모·카테고리가 유실 없이 회원 계정으로 이어집니다.
  - 탈퇴 완료 후 초기 게스트 상태(또는 로그인 해제 상태)로 안전하게 전환됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 연동 직후: guest_token은 NULL, user_id로 이관 확인
  SELECT id, user_id, guest_token, left(content, 30) FROM memos WHERE user_id = '<연동된_user_id>';
  -- 탈퇴 직후: users 및 소유 memos/categories 0건 확인
  SELECT COUNT(*) FROM users WHERE id = '<탈퇴한_user_id>';
  ```
- **증적**: `screenshots/tc09-social-link-and-withdraw.png`

---

## Group F. 반응형 모바일 뷰포트 & 보조 페이지 점검

### `TC-10`: 모바일 3종 뷰포트 레이아웃 & `/guide`, `/download` 페이지 점검
- **사전 조건**: DevTools 모바일 에뮬레이션 활성화
- **화면 수행 절차**:
  1. `360×640`, `390×844`, `430×932` 뷰포트 각각에서 메인 타임라인, 사이드바 드로어(좌측 스와이프 오픈/닫기), 하단 퀵 캡처 입력란, 카테고리 바텀시트, 검색바를 조작합니다.
  2. `/guide` 페이지와 `/download` 페이지(APK 버전 `v1.0.6` 표기 및 다운로드 링크 `/downloads/ideamory-android-v1.0.6.apk`)를 확인합니다.
- **기대 결과 (UI)**:
  - 3개 뷰포트 모두 가로 스크롤(`scrollWidth > clientWidth`) `0건`, 입력란 1줄/다줄 Y축 정렬 정상, 검색바 `✕` 버튼 중복 없음.
  - `/download`의 표기 버전이 `build.gradle` `versionName`과 일치하고 Warm Dark 테마 토큰이 일관되게 적용되어 있습니다.
- **증적**: `screenshots/tc10-mobile-viewports-and-pages.png`
