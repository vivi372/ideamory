# Ideamory 통합 테스트 시나리오 (UI + Supabase MCP DB)

> **목적**: 실제 브라우저 화면 동작과 Supabase PostgreSQL DB 적재 값을 교차 검증하고, GitHub README용 시연 영상 및 스크린샷 증적을 확보합니다.  
> **참고**: 백엔드 단위/API 계약/로깅 검증은 `pnpm --filter @ideamory/api test`로 갈음합니다.

## ⚙️ 공통 검증 수칙 (실행 전 필독)

1. **소유권 컬럼 매핑 전환 (`guest_token` ➔ `user_id`)**:
   - `TC-01`~`TC-08`의 SQL 예시는 게스트 세션 기준(`WHERE guest_token = '<guest_token>'`)으로 작성되어 있습니다.
   - 소셜 계정 연동(`TC-09`) 이후 또는 정회원 상태에서 시나리오를 검증할 때는 `guest_token`이 `NULL`로 이관되므로 반드시 `WHERE user_id = '<user_id>'` 조건으로 전환해 조회합니다.
2. **비동기 백그라운드 파이프라인 대기 타이밍**:
   - `TC-02`, `TC-03`, `TC-05`, `TC-07`은 Gemini LLM 분류, 768차원 임베딩, 유사 카테고리 탐지 워커 완료 후 DB가 갱신됩니다.
   - 따라서 전송 직후 즉시 조회해 `embedding IS NULL` 오탐이 나지 않도록 **화면 폴링 반영(약 3~5초) 완료를 확인한 뒤** Supabase MCP `execute_sql`을 실행합니다.
3. **3-Tier 분산 트레이싱(`X-Trace-Id`) & CORS 헤더 병행 확인**:
   - 테스트 진행 중 브라우저 DevTools `Network` 탭에서 프론트엔드(Vercel/Web) ➔ 백엔드(Northflank/API) 요청·응답의 32자리 Hex `X-Trace-Id` 전파 및 CORS 헤더 노출 여부를 함께 확인합니다.
4. **세션 파괴 테스트(`TC-08`, `TC-09`) 실행 순서 격리**:
   - `TC-08`(게스트 초기화)과 `TC-09`(회원탈퇴)는 기존 세션의 메모·카테고리를 영구 파기하므로, 반드시 `TC-01`~`TC-07`의 화면 점검·DB 교차 검증·스크린샷 및 README 영상 녹화를 모두 완료한 뒤 마지막 단계에서 실행합니다.

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
  - `memos`에 `[사용 가이드]` 온보딩 시드 메모가 정확히 **1건** 생성되었는지, `categories`에 해당 카테고리 1건, `ogp_caches`에 `/guide` OGP가 정상 연결(`ogp_id IS NOT NULL`)되어 있는지 확인합니다.
- **증적**: `screenshots/tc01-onboarding-and-drawer.png`

---

## Group B. 0.1초 퀵 캡처 & AI / OGP 백그라운드 파이프라인

### `TC-02`: 0.1초 퀵 캡처, 클립보드 포착 칩, `@카테고리` 공백 정규화 ★ README 영상 녹화
- **사전 조건**: 메인 타임라인 활성 상태, 클립보드에 유효한 URL(`https://nextjs.org`) 복사 상태
- **화면 수행 절차**:
  1. 하단 썸존 입력란을 포커스해 상단에 `"복사한 링크 붙여넣기"` 클립보드 포착 버블 칩이 노출되는지 확인하고, 원클릭 삽입 동작을 점검합니다.
  2. 입력란을 비운 뒤 `@개발 리팩토링 체크리스트 정리하기`를 입력해(`@개발` 하이라이트 확인) `Enter` 또는 `+` 버튼으로 전송합니다.
  3. 공백 정규화 검증을 위해 `@예외 사항 테스트 1`과 `@예외사항 테스트 2`를 연속으로 입력·전송합니다.
  4. 10자 초과 또는 이모지 포함 `@🚀테스트` 등 예외 입력 시 `FIELD` 에러 캡션 노출 여부를 확인합니다.
- **기대 결과 (UI)**:
  - 클립보드 URL이 원클릭으로 입력란에 삽입됩니다.
  - 전송 즉시 대기 스피너 없이 0.1초 내 타임라인 최상단에 카테고리 배지가 달린 메모 카드가 나타나고, 본문에서는 `@카테고리` 지시어가 제거됩니다.
  - `@예외 사항`과 `@예외사항`이 사이드바 `LIBRARY`에서 별도 카테고리로 쪼개지지 않고 단일 카테고리로 합산(`memoCount` 증가)됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 1) 본문 정제 및 768차원 임베딩(폴링 완료 후) 확인
  SELECT m.id, m.content, c.id AS category_id, c.name AS category_name, c.normalized_name,
         (m.embedding IS NOT NULL) AS has_embedding
  FROM memos m
  JOIN categories c ON m.category_id = c.id
  WHERE m.guest_token = '<guest_token>'
  ORDER BY m.created_at DESC
  LIMIT 5;
  ```
  - `content`에서 `@개발` 등이 제거되어 있고, `@예외 사항`·`@예외사항` 메모 2건이 `c.normalized_name = '예외사항'`을 가진 **동일한 `category_id`**에 매핑되어야 합니다.
- **증적**:
  - 스크린샷: `screenshots/tc02-quick-capture.png`
  - ★ README 영상: `videos/01-quick-capture.webm`

### `TC-03`: AI 백그라운드 자동 분류, 768차원 임베딩 & OGP N:1 캐시 재사용 ★ README 영상 녹화
- **사전 조건**: 메인 타임라인 활성 상태
- **화면 수행 절차**:
  1. 하단 입력란에 카테고리 지시어 없이 URL 포함 메모를 입력 후 전송합니다.
     예: `넥스트 공식 문서 App Router 캐싱 전략 정리 https://nextjs.org`
  2. 스켈레톤/미분류 상태에서 백그라운드 폴링(최대 3~5초) 완료 후 카드 변화를 관찰합니다.
  3. **OGP N:1 공유 캐시 & 1개 URL 원칙 검증**:
     - 동일 URL(`https://nextjs.org`)을 포함한 두 번째 메모를 작성해 기존 캐시 재사용 여부를 확인합니다.
     - 복수의 URL(`https://nextjs.org https://react.dev`)이 포함된 메모를 작성해 첫 번째 URL 1개만 OGP로 파싱되는지 확인합니다.
- **기대 결과 (UI)**:
  - 0.1초 내 `미분류` 배지 + OGP 스켈레톤 상태로 카드가 선렌더링됩니다.
  - 몇 초 뒤 새로고침 없이 자동으로 AI가 추천한 카테고리명으로 배지가 바뀌고, `nextjs.org` OGP 미리보기 카드로 자동 전환됩니다.
  - 복수 URL 메모에도 첫 번째 URL(`nextjs.org`) OGP 카드 1개만 렌더링됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 1) AI 분류·임베딩·OGP 연결 확인
  SELECT m.id, c.name AS ai_category, (m.embedding IS NOT NULL) AS has_memo_vec,
         m.ogp_id, o.target_url, o.title AS ogp_title, o.expires_at
  FROM memos m
  JOIN categories c ON m.category_id = c.id
  LEFT JOIN ogp_caches o ON m.ogp_id = o.id
  WHERE m.guest_token = '<guest_token>'
  ORDER BY m.created_at DESC
  LIMIT 3;

  -- 2) 동일 URL에 대해 ogp_caches 행이 1건만 존재하는지(N:1 공유) 확인
  SELECT id, target_url, fetched_at, expires_at
  FROM ogp_caches
  WHERE target_url LIKE 'https://nextjs.org%';
  ```
  - `ai_category <> '미분류'`, `has_memo_vec = true`, 동일 URL 메모들이 같은 `ogp_id`를 공유하며 `ogp_caches` 행이 중복 생성되지 않아야 합니다.
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

### `TC-05`: AI 유사 카테고리 병합 제안(`합치기` / `합치지 않기`) & 원자적 병합 ★ README 영상 녹화
- **사전 조건**: 의미론적으로 유사한 카테고리 쌍 생성 후 백그라운드 유사도 탐지 완료 상태
  - 쌍 1 (병합 승인용): `@프론트엔드 리액트 훅 정리` / `@프론트 UI 컴포넌트 패턴`
  - 쌍 2 (병합 거절용): `@백엔드 API 설계` / `@서버 엔드포인트 정리`
- **화면 수행 절차**:
  1. 사이드바 드로어를 열어 유사 카테고리 옆 앰버/오렌지 닷(`●`) 표시를 확인합니다.
  2. 쌍 1 카테고리를 선택해 상단 `MergeSuggestionBanner`에서 **`[합치기]`**를 클릭합니다.
  3. 쌍 2 카테고리를 선택해 상단 `MergeSuggestionBanner`에서 **`[합치지 않기]`**를 클릭합니다.
- **기대 결과 (UI)**:
  - `[합치기]` 시 대상 카테고리 뷰로 전환되며 두 카테고리의 메모가 통합되고 원본 카테고리가 사라집니다.
  - `[합치지 않기]` 시 배너와 사이드바 오렌지 닷(`●`)이 즉시 영구 소멸하며 새로고침 후에도 재노출되지 않습니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 1) 병합 후 원본 카테고리 삭제 확인
  SELECT id, name FROM categories WHERE guest_token = '<guest_token>';
  -- 2) 병합 승인(CASCADE) 및 병합 거절(DELETE) 후 제안 큐 0건 확인
  SELECT * FROM category_merge_suggestions
  WHERE source_category_id IN ('<병합원본_id>', '<거절원본_id>')
     OR target_category_id IN ('<병합원본_id>', '<거절원본_id>');
  -- 3) (제안 큐 미생성 시 참고) 두 카테고리의 실제 코사인 유사도 >= 0.85 충족 여부 확인
  SELECT c1.name AS source_name, c2.name AS target_name,
         1 - (c1.embedding <=> c2.embedding) AS cosine_similarity
  FROM categories c1
  JOIN categories c2 ON c1.id <> c2.id
  WHERE c1.id = '<원본_id>' AND c2.id = '<대상_id>';
  ```
- **증적**:
  - 스크린샷: `screenshots/tc05-category-merge.png`
  - ★ README 영상: `videos/03-category-merge.webm`

### `TC-06`: 메모 30일 휴지통 이동, 빈 카테고리 0ms 숨김 & 원클릭 복구
- **사전 조건**: 메모가 정확히 1건만 속한 특정 카테고리(예: `아키텍처`) 존재
- **화면 수행 절차**:
  1. 해당 카테고리의 유일한 메모 카드 우측 상단 휴지통 아이콘을 눌러 삭제(Soft Delete)합니다.
  2. 사이드바 드로어와 카테고리 피커 시트를 열어 `아키텍처` 카테고리가 즉시 사라졌는지 확인합니다.
  3. 사이드바 드로어 ➔ `휴지통`으로 이동해 삭제된 메모가 보관되어 있는지 확인합니다.
  4. `[복구]` 버튼을 눌러 활성 타임라인으로 복구하고, 드로어에 카테고리가 다시 노출되는지 확인합니다.
- **기대 결과 (UI)**:
  - 활성 메모가 0건이 된 카테고리는 드로어·피커에서 `0ms` 즉시 숨김 처리됩니다.
  - 휴지통 뷰에서는 인라인 편집 및 카테고리 변경이 비활성화되며, 복구 시 원래 카테고리와 함께 즉시 복귀합니다.
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
  1. 상단 검색바에 한국어/영문 질의어를 입력할 때 타이핑 도중에는 API가 호출되지 않는지 Network 탭으로 확인한 뒤 `[Enter]`를 누릅니다.
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
  - 기존 게스트 메모가 모두 제거되고, 클라이언트 `localStorage`에 **새로운 `guest_token`**이 재발급되어 초기 온보딩 시드 상태(`/guide` 메모)로 리셋됩니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 1) 이전 guest_token 잔여 레코드 0건 확인
  SELECT COUNT(*) AS remaining_memos FROM memos WHERE guest_token = '<이전_guest_token>';
  SELECT COUNT(*) AS remaining_cats FROM categories WHERE guest_token = '<이전_guest_token>';
  -- 2) 재발급된 신규 guest_token으로 온보딩 시드 메모 1건 복원 확인
  SELECT id, left(content, 40) AS preview FROM memos WHERE guest_token = '<신규_guest_token>';
  ```
  - 이전 세션 카운트는 모두 `0`이고, 신규 `guest_token`에는 온보딩 시드 메모 1건이 정상 복원되어야 합니다.
- **증적**: `screenshots/tc08-guest-reset.png`

### `TC-09`: 소셜 계정 연동(이관), Zero-Profile UI, 인앱 약관 모달 & 회원탈퇴
- **사전 조건**:
  - 게스트 세션에 테스트 메모 1건 이상 작성된 상태
  - **OAuth 사전 확인**: Supabase Auth 대시보드에 테스트 대상 도메인(로컬 또는 Vercel 프로덕션 URL)의 Redirect URI 및 소셜 공급자(Google / GitHub / Kakao) 설정이 활성화되어 있는지 확인
- **화면 수행 절차**:
  1. 사이드바 드로어 하단 `계정 연동하기` ➔ `[서비스 이용약관]` 및 `[개인정보 처리방침]` 링크를 클릭해 인앱 약관 모달(`.legal-sheet`)이 열리는지 확인합니다.
  2. Google/GitHub 소셜 로그인을 진행해 계정 연동을 완료합니다.
  3. 연동 완료 후 사이드바 드로어 하단 계정 영역과 기존 게스트 메모 유지 여부를 확인합니다.
  4. 사이드바 하단 `회원탈퇴` 진행 후 확인 모달을 승인합니다.
- **기대 결과 (UI)**:
  - 약관 클릭 시 외부 브라우저로 이탈하지 않고 인앱 전체화면 바텀시트 모달로 렌더링됩니다.
  - Zero-Profile 원칙에 따라 프로필 이미지나 이메일이 전혀 노출되지 않고 `{제공자} 연동됨` 상태 문구만 표출됩니다.
  - 기존 게스트 메모·카테고리가 유실 없이 회원 계정으로 이어지며, 탈퇴 시 초기 상태로 안전하게 복귀합니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  -- 연동 직후: guest_token은 NULL, user_id로 이관 확인
  SELECT id, user_id, guest_token, left(content, 30) FROM memos WHERE user_id = '<연동된_user_id>';
  -- 탈퇴 직후: auth.users 및 소유 memos/categories ON DELETE CASCADE 0건 확인
  SELECT COUNT(*) AS remaining_users FROM auth.users WHERE id = '<탈퇴한_user_id>';
  SELECT COUNT(*) AS remaining_memos FROM memos WHERE user_id = '<탈퇴한_user_id>';
  SELECT COUNT(*) AS remaining_cats FROM categories WHERE user_id = '<탈퇴한_user_id>';
  ```
- **증적**: `screenshots/tc09-social-link-and-withdraw.png`

---

## Group F. 모바일 뷰포트, 웹뷰 브릿지 & 오프라인 점검

### `TC-10`: 모바일 3종 뷰포트 레이아웃 & `/guide`, `/download` 페이지 점검
- **사전 조건**: DevTools 모바일 에뮬레이션 활성화
- **화면 수행 절차**:
  1. `360×640`, `390×844`, `430×932` 뷰포트 각각에서 메인 타임라인, 사이드바 드로어(좌측 45% 스와이프 오픈/닫기), 하단 퀵 캡처 입력란, 카테고리 바텀시트, 검색바를 조작합니다.
  2. `/guide` 페이지와 `/download` 페이지(APK 버전 표기 및 다운로드 링크)를 확인합니다.
- **기대 결과 (UI)**:
  - 3개 뷰포트 모두 가로 스크롤(`scrollWidth > clientWidth`) `0건`, 입력란 1줄/다줄 Y축 정렬 정상, 검색바 `✕` 버튼 중복 없음.
  - `/download` 표기 버전이 `android/app/build.gradle`의 `versionName`과 일치하고 Warm Dark 테마 토큰이 일관되게 적용되어 있습니다.
- **증적**: `screenshots/tc10-mobile-viewports-and-pages.png`

### `TC-11`: 웹뷰 브릿지(Share Intent · 뒤로가기 스택) & 브랜드 오프라인 바운더리
- **사전 조건**: 메인 페이지 실행 상태
- **화면 수행 절차**:
  1. **Share Intent 주입**: `/?share_text=공유테스트&share_url=https://nextjs.org` URL로 진입하여 하단 썸존 입력란 주입 및 주소창 쿼리스트링 정리를 확인합니다.
  2. **뒤로가기 스택**: 연관 메모/검색 필터 활성화 ➔ 카테고리 피커 오픈 ➔ 사이드바 드로어 오픈 ➔ 소셜 연동 시트 ➔ 약관 모달(`.legal-sheet`)까지 다중 오픈한 상태에서 브라우저 뒤로가기(`popstate` 또는 Capacitor `backButton`)를 순차 실행합니다.
  3. **오프라인 바운더리**: DevTools `Network` ➔ `Offline` 전환 후 `OfflineBoundary` 커스텀 화면 노출을 확인하고, 다시 `Online` 전환 후 `[다시 시도]` 클릭 복구를 점검합니다.
- **기대 결과 (UI)**:
  - 공유 텍스트와 URL이 썸존에 즉시 채워지고 주소창은 `/`로 깔끔히 정리됩니다.
  - 뒤로가기 시 최상위 오버레이부터 우선순위(`약관 모달 ➔ 소셜 연동 시트 ➔ 카테고리 피커 ➔ 사이드바 드로어 ➔ 검색/관련 메모 필터 ➔ 서브 뷰`) 순으로 1개씩 닫히며, 홈 타임라인에서는 2초 내 2회 입력 시 종료 안내가 동작합니다.
  - 오프라인 시 하얀 에러 페이지 대신 Warm Dark 브랜드 오프라인 뷰가 표시되고 `[다시 시도]`로 정상 복구됩니다.
- **증적**: `screenshots/tc11-bridge-and-offline.png`

---

## Group G. 제텔카스텐 지식망 & MCP 연동

### `TC-12`: 제텔카스텐 지식망(Knowledge Graph) 탐색, OGP 미리보기 & 인라인 편집
- **사전 조건**: 서로 주제가 유사한 메모 2건 이상(임베딩 생성 완료 상태) 및 URL/가이드 OGP가 포함된 메모 1건 이상
- **화면 수행 절차**:
  1. 상단 `타임라인 | 지식망` 뷰 전환 탭에서 `지식망`으로 전환합니다.
  2. 상단 연결 범위 슬라이더(`넓게 · 보통 · 핵심만`)를 좌우로 조절하여 연결선(엣지) 수 변화를 확인합니다.
  3. 우측 하단 미니맵 및 리센터(`중앙 정렬`) 버튼을 클릭해 카메라 뷰포트 정렬을 확인합니다.
  4. OGP 링크가 포함된 노드를 탭/클릭해 하단 미니 카드 시트(`.graph-node-sheet`)를 열고, 시트 내 OGP 미리보기 박스(`.ogp-card`) 클릭 시 가이드 이동(`/guide`) 또는 외부 링크 새 탭 열기가 동작하는지 확인합니다.
  5. 미니 카드 시트에서 인라인 수정(`Pencil`) 및 휴지통 이동(`Trash2`)이 즉시 반영되는지 확인합니다.
- **기대 결과 (UI)**:
  - 유사도 기준을 높이면 강한 연결선만 남고, 낮추면 연관 노드 간 링크가 부드럽게 추가됩니다.
  - 노드 간 거리가 모바일/웹 모두 화면 안에 자연스럽게 배치되며, 미니 카드 시트의 OGP 미리보기 박스를 통해 원문/가이드로 즉시 이동할 수 있습니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, left(content, 30) AS preview, ogp_id, (embedding IS NOT NULL) AS has_embedding
  FROM memos
  WHERE guest_token = '<guest_token>' AND deleted_at IS NULL;
  ```
  - 그래프에 표시되는 활성 메모에 `embedding`이 존재하고, OGP 연결 메모는 `ogp_id`가 매핑되어 있는지 확인합니다.
- **증적**: `screenshots/tc12-knowledge-graph.png`

### `TC-13`: MCP 연동 시트 (API 키 발급 · 재발급 · 폐기 & 연결 설정 복사)
- **사전 조건**: 게스트 또는 소셜 로그인 세션 활성 상태
- **화면 수행 절차**:
  1. 사이드바 드로어 하단 `MCP 연동` 버튼을 클릭해 MCP 연동 바텀시트를 엽니다.
  2. `[API 키 발급하기]` 클릭 후 마스킹되지 않은 원문 API 키(`idm_...`) 1회 노출 및 `[복사]` 버튼 동작을 확인합니다.
  3. Claude Desktop / Cursor용 JSON 설정 스니펫 복사 버튼을 클릭하고, `https://.../api/v1/mcp` 엔드포인트 URL이 올바르게 포함되어 있는지 확인합니다.
  4. 발급된 키를 이용해 외부 MCP JSON-RPC 호출(`tools/list` 또는 `search_memos`)이 `Authorization: Bearer idm_...` 헤더로 정상 응답하는지 확인합니다.
  5. `[키 재발급]` 및 `[연결 해제(폐기)]` 동작 후 기존 키가 즉시 무효화(`401 Unauthorized`)되는지 확인합니다.
- **기대 결과 (UI)**:
  - 발급 직후에만 원문 키가 표시되고 이후 새로고침 시 prefix(`idm_xxxx...`)만 마스킹 표시됩니다.
  - 모바일 뷰포트(`360×640`)에서도 바텀시트 스크롤 및 복사 버튼 배치가 깨지지 않습니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, key_prefix, last_used_at, revoked_at, created_at
  FROM mcp_api_keys
  WHERE (guest_token = '<guest_token>' OR user_id = '<user_id>')
  ORDER BY created_at DESC;
  ```
  - DB에는 원문 키 대신 `key_hash`와 `key_prefix`만 저장되며, 재발급/폐기 시 이전 키에 `revoked_at`이 기록되는지 확인합니다.
- **증적**: `screenshots/tc13-mcp-integration.png`

---

## Group H. 썸존 `[AI]` 토글 & 포커스 헤더 단일 브리핑 (RAG)

### `TC-14`: 썸존 `[AI]` 모드 진입, RAG 단일 브리핑 & 중복 전송 차단/중단 ★ README 영상
- **사전 조건**: 임베딩 생성이 완료된 메모 2건 이상 보유 (예: `@개발` 또는 유사 주제 메모)
- **화면 수행 절차**:
  1. 하단 썸존 입력 바 좌측 `[AI]` 토글 버튼을 클릭합니다.
  2. 상단 헤더가 `[←]` 화살표 아이콘 + 중앙 `AI 검색` 미니멀 포커스 헤더(`FocusHeader`)로 전환되고, 중앙 타임라인이 비워지며 `"내 메모에 대해 무엇이든 물어보세요"` 안내 및 추천 예시 칩 3종(`AiSearchIdle`)이 노출되는지 확인합니다.
  3. 입력창 플레이스홀더가 `"내 메모에 대해 무엇이든 물어보세요"`로 전환되고 우측 버튼이 `[🔍]`으로 변경되었는지 확인합니다.
  4. 추천 예시 칩 또는 직접 질의를 입력해 전송하고, 응답 대기 중 우측 버튼이 `[■ 중단]`으로 바뀌며 `Enter`/중복 전송이 차단되는지 확인합니다. (1회는 `[■ 중단]` 버튼으로 명시 취소 후 재전송 검증)
  5. AI 브리핑 완료 시 `**1행 결론**` + 불릿 포인트(`AiBriefingCard`)와 하단 1-Depth 근거 메모 카드(`AiSourceCardList`, 3~5건)가 렌더링되는지 확인합니다.
  6. 연속으로 다른 질문을 전송했을 때 대화 스레드가 아래로 누적되지 않고 최신 1건 브리핑으로 100% 덮어쓰기(Single-Briefing Replace) 되는지 확인합니다.
- **기대 결과 (UI)**:
  - `390×844` 모바일 뷰포트에서 가로 스크롤 0건, 버튼 겹침 0건, 마크다운 줄바꿈 정상.
  - 근거 메모 카드 본문 클릭 시 인라인 수정이 즉시 동작합니다.
- **Supabase MCP DB 검증 (`execute_sql`)**:
  ```sql
  SELECT id, left(content, 40) AS preview, category_id, (embedding IS NOT NULL) AS has_embedding
  FROM memos
  WHERE guest_token = '<guest_token>' AND deleted_at IS NULL
  ORDER BY created_at DESC;
  ```
  - 브리핑 하단 `sources`로 노출된 메모 ID·본문·카테고리가 DB 활성 메모와 100% 일치하는지 확인합니다.
- **증적**: `screenshots/tc14-ai-rag-briefing.png`, `videos/04-ai-rag-briefing.webm`

### `TC-15`: AI 모드 0ms 이탈 복귀 & 드로어 전환 시 상태 잔류 차단
- **사전 조건**: `TC-14`에서 AI 검색 포커스 모드(`isAiMode: true`) 활성화 상태
- **화면 수행 절차**:
  1. 상단 `FocusHeader` 좌측 `[←]` 아이콘 클릭 시 `0ms`로 일반 타임라인과 기본 헤더로 복귀하는지 확인합니다.
  2. 다시 `[AI]` 토글을 켠 뒤 `[AI]` 버튼을 재클릭해 해제할 때 동일하게 즉시 복귀하는지 확인합니다.
  3. `[AI]` 토글 활성화 상태에서 사이드바 드로어(`☰`)를 열어 `휴지통`으로 이동한 뒤 다시 `전체 메모`로 복귀했을 때 AI 검색 포커스 화면이 재노출되지 않는지 확인합니다.
- **기대 결과 (UI)**:
  - 모든 이탈 경로에서 진행 중이던 AI 요청은 즉시 중단(`AbortController.abort()`)되고 에러 토스트가 노출되지 않으며, 드로어 전환 후에도 `isAiMode` 상태가 잔류하지 않습니다.
- **증적**: `screenshots/tc15-ai-exit-and-drawer.png`
