# 📋 Ideamory 개발 실행 플랜 및 진행도 체크리스트 (v2.0)

> **프로젝트**: Ideamory (아이디모리) — 모바일 퍼스트 0.1초 퀵 캡처 & AI 하이브리드 지식 서재  
> **아키텍처**: Monorepo (Turborepo + pnpm workspaces)  
> **핵심 스택**: Next.js 15 (React 19) + NestJS + PostgreSQL 17 (Drizzle ORM, postgres.js, pgvector) + Supabase Auth (jose ES256) + Gemini AI  
> **최근 업데이트**: 2026-11-26 (6-2 썸존 `[AI]` 토글·포커스 헤더 단일 브리핑 UI 및 Android v1.1.0 빌드 완료 — 전체 26/26 100%)  

---

## 📊 종합 진행 현황 (Progress Dashboard)

| 단계 | 구분 | 목표 및 핵심 영역 | 진행 상태 | 완료율 |
| :---: | :--- | :--- | :---: | :---: |
| **0단계** | **기반 환경** | Monorepo 구성 및 공통 Config 설정 | ✅ 완료 | `3 / 3` (100%) |
| **1단계** | **공통 모듈** | PostgreSQL DDL, Drizzle ORM 매핑, 인덱스, DTO 규격 | ✅ 완료 | `4 / 4` (100%) |
| **2단계** | **백엔드 API** | NestJS 코어 비즈니스, AI 임베딩, 검색, 캡처 | ✅ 완료 | `6 / 6` (100%) |
| **3단계** | **프론트엔드** | Next.js 15 퍼블리싱 이식, 낙관적 UI, API 연동 (FSD) | ✅ 완료 | `6 / 6` (100%) |
| **4단계** | **확장 고도화** | Zero-Effort AI 제텔카스텐(지식망) & MCP 서버·API 키 관리 | ✅ 완료 | `2 / 2` (100%) |
| **5단계** | **E2E & 배포** | 3-Tier 통합 연동, 분산 트레이싱, 무결성 검증 | ✅ 완료 | `3 / 3` (100%) |
| **6단계** | **AI 브레인 RAG** | 썸존 `[AI]` 토글 & 단일 브리핑 교체(Single-Briefing Replace) RAG | ✅ 완료 | `2 / 2` (100%) |
| **전체** | **Total** | **엔드투엔드 프로덕션 릴리스 및 AI 브레인 확장** | **완료** | **`26 / 26` (100%)** |

```
진행률: [================================================] 100.0%
```

---

## 🏗️ 0단계: 초기 프로젝트 생성 및 개발 환경 구축

- **목표**: 일관된 코드 품질과 빠른 빌드 파이프라인을 지원하는 pnpm 모노레포 환경을 구성합니다.
- **주요 산출물**: `pnpm-workspace.yaml`, `turbo.json`, shared configs 패키지

- [x] **0-1. Monorepo 워크스페이스 환경 구성**
  - `pnpm` workspace 및 `Turborepo` 파이프라인(`turbo.json`) 초기화
  - `.gitignore`, `.editorconfig` 등 루트 레벨 협업 규칙 설정
- [x] **0-2. 공통 Config 패키지 구축 (`packages/`)**
  - `packages/tsconfig`: TypeScript strict 모드 기반 공통 컴파일러 설정
  - `packages/eslint-config`: ESLint + Prettier 통합 린팅 규칙 패키지
- [x] **0-3. Apps 및 Packages 기본 스캐폴딩**
  - **Apps**: `apps/web` (Next.js 15), `apps/api` (NestJS)
  - **Packages**: `packages/db` (Drizzle ORM + postgres.js 풀링/스키마), `packages/api-spec` (Zod DTO)

---

## 🗄️ 1단계: 공통 DB 및 DTO/명세 모듈 개발 (`packages/`)

- **목표**: 백엔드와 프론트엔드가 공유할 강력한 타입 안전성(Zod)과 Drizzle ORM + PostgreSQL(pgvector) 데이터베이스 엔진을 구축합니다. (BaaS 종속적인 DB Stored Function/RPC 및 RLS를 배제하고 백엔드 서비스 쿼리로 일원화)
- **주요 산출물**: `packages/api-spec` DTO, Drizzle ORM pgTable 스키마, SQL 마이그레이션 DDL, HNSW/GIN 인덱스

- [x] **1-1. Zod 기반 전역 DTO 및 Validation 스키마 구성 (`packages/api-spec`)**
  - 메모 생성/수정, 카테고리, 검색 쿼리, 페이징 DTO 정의
  - 32자리 W3C Trace ID 정규식(`/^[0-9a-fA-F]{32}$/`) 표준화 반영
  - OpenAPI(Swagger) 타입 자동 추론 및 클라이언트 유효성 검사 모듈
- [x] **1-2. PostgreSQL 핵심 테이블 스키마 DDL 작성 (`packages/db`)**
  - `categories` (선발급 UUID v7, 정규화 부분 유니크 인덱스, 글자수/소유권 CHECK 제약)
  - `ogp_caches` (14일 TTL 메타데이터 캐시, URL 유니크 인덱스)
  - `memos` (UUID v7 PK, 768차원 vector, 배타적 소유권 CHECK, 타임라인 인덱스)
  - 외래키 정책(CASCADE, RESTRICT, SET NULL) 및 제약조건 100% 검증 통과
- [x] **1-3. Drizzle ORM 매핑 및 postgres.js 경량 풀링 구축 (`packages/db`)**
  - `drizzle.config.ts` 마이그레이션 설정 및 Drizzle `pgTable` 스키마 4종 완비
  - `postgres(DATABASE_URL, { max: 10, idle_timeout: 20 })` 기반 Always-On 단일 인스턴스 인프로세스 풀링
  - Drizzle `db`, `client`, 전체 `schema` 단일 진실 공급원(SSOT) 익스포트
- [x] **1-4. pgvector 768차원 HNSW 인덱스 및 FTS(Full-Text Search) 설정 (`packages/db`)**
  - Gemini 임베딩 모델 규격(768차원)에 맞춘 HNSW 벡터 인덱스 (`vector_cosine_ops`, `m = 16, ef_construction = 64`)
  - 한글/영문 전문 검색을 위한 PostgreSQL `tsvector` FTS GIN 인덱스 구축 및 Drizzle 스키마 인덱스 완비

---

## ⚡ 2단계: NestJS 백엔드 핵심 기능 개발 (`apps/api/`)

- **목표**: 0.1초 반응성을 보장하는 고성능 비동기 API, jose 오프라인 인증 및 Gemini AI 파이프라인을 구축합니다.
- **주요 산출물**: REST API 엔드포인트, Swagger UI, W3C 32자리 분산 트레이싱, jose ECC P-256 AuthGuard, Drizzle SQL 하이브리드 검색, AI 비동기 워커

- [x] **2-1. W3C 32자리 분산 트레이싱 및 CORS 노출 인터셉터**
  - 32자리 Hex `X-Trace-Id` 발급/전파 및 All-Zero 무효화 처리
  - `traceStore(AsyncLocalStorage)` 전역 비동기 추적 컨텍스트 바인딩
  - CORS `Access-Control-Expose-Headers: X-Trace-Id` 등록 및 콘솔 앞 8자리 축약 로깅
  - `performance.now()` 정밀 실행 시간 측정 및 민감 정보(`password`, `token`, `guestToken` 등) `[MASKED]` 마스킹
- [x] **2-2. API 공통 인프라 & 보안 파이프라인 (jose AuthGuard + 예외 필터 + Swagger)**
  - `jose` 기반 최신 Supabase Auth (ECC Curve P-256 / ES256) JWT 로컬 인증 가드 (`createRemoteJWKSet`, `request.user.id` 바인딩, `@CurrentUser()`)
  - 공통 예외 처리 필터 (`GlobalExceptionFilter`) 및 UX 태그(토스트, 모달) 표준 에러 응답 규격 (`ErrorResponseDto`)
  - 전역 유효성 검사 파이프 (`ZodValidationPipe`) 연결
  - Vercel 프론트엔드 도메인 전용 CORS 설정 및 대화형 Swagger UI (`/api/docs`) 구축
- [x] **2-3. 세션 & 유저 데이터 라이프사이클 (Drizzle 트랜잭션)**
  - 익명 게스트 세션 및 시드 데이터 발급 (`db.transaction()` 기반 게스트 UUID 발급 및 튜토리얼 메모 3종 원자적 생성)
  - 소셜 계정 데이터 이관(마이그레이션) 및 계정 초기화/탈퇴 (게스트 ➔ 소셜 계정 승격 트랜잭션, 데이터 클린업)
- [x] **2-4. 메모 코어 파이프라인 & OGP 크롤러 (Core)**
  - 0.1초 퀵 캡처 API (UUID v7 선발급 즉시 선응답, 인라인 `@카테고리` 태그 자동 파싱, Gemini 768차원 임베딩 비동기 이벤트 발행)
  - 메모 타임라인 조회 (커서 기반 페이지네이션), 실수 방지 소프트 삭제(`deleted_at`) 및 원클릭 복구 API
  - 링크 포함 시 OGP 비동기 메타데이터 파싱 및 14일 TTL 캐싱/만료 크론 스케줄러
- [x] **2-5. 카테고리 관리 & AI 유사 카테고리 통합 API**
  - 텍스트 전용 카테고리 CRUD (글자수/소유권 제약 준수)
  - AI 임베딩 유사도 기반 중복/유사 카테고리 탐지 및 원클릭 병합 기능
- [x] **2-6. AI 하이브리드 검색 & 연관 메모 추천 엔진**
  - Drizzle Raw SQL 기반 키워드 FTS(0.4) + 의미 Vector(0.6) 가중치 결합 하이브리드 검색 쿼리
  - 특정 메모 기준 코사인 거리 기반 연관 메모 1-Depth 추천 엔드포인트

---

## 🎨 3단계: React / Next.js 프론트엔드 핵심 UI/UX 개발 (`apps/web/`)

- **목표**: `publishing/`에 완성된 UI 퍼블리싱을 FSD 아키텍처로 이식하고, 낙관적 UI 및 백엔드 REST API(`/api/v1/*`)와 완전히 연동합니다.
- **주요 산출물**: FSD 기반 페이지/컴포넌트, TanStack Query 캐싱·낙관적 UI, 전역 UX 에러 피드백, `/guide` 페이지

- [x] **3-1. 공통 REST API 클라이언트 및 에러 인터셉터**
  - Axios 인스턴스 구축 (`/api/v1` Base URL 정규화) 및 `X-Trace-Id` / 배타적 인증 헤더 자동 주입
  - 백엔드 UX 태그(`FIELD`/`INFO`/`WARN`/`ERROR`/`ALERT`/`CONFIRM`/`FATAL`) 연계 전역 에러 디스패처
- [x] **3-2. 퍼블리싱 베이스 이식, TanStack Query & 전역 피드백 시스템 (Toast/Dialog)**
  - `publishing/` 스타일(`globals.css`), 폰트/에셋 및 `/guide` 페이지 이식 (`apps/web/src/app/`)
  - TanStack Query v5 Provider & Zustand 클라이언트 뷰 상태(`전체 메모` / `카테고리` / `휴지통`) 구축
  - `error-dispatcher` 구독 기반 전역 피드백 UI (Toast 알림, `ALERT`/`CONFIRM`/`FATAL` 다이얼로그, 위험 작업 확인 모달)
- [x] **3-3. 익명 게스트 부트스트랩, 사이드바 드로어 & 소셜 계정 연동 플로우**
  - 초기 진입 시 `POST /api/v1/auth/guest/init` 자동 세션 발급 및 온보딩 시드 메모(`/guide` OGP) 로드
  - 사이드바 드로어(`LIBRARY` 카테고리 카운트, `휴지통`), 게스트 초기화(`POST /api/v1/auth/guest/reset`), 소셜 연동 바텀시트(`POST /api/v1/auth/social/link`) 및 회원탈퇴(`DELETE /api/v1/auth/account`) 실 API 연동
- [x] **3-4. 0.1초 퀵 캡처 썸존 & 메모 타임라인 낙관적 UI / 인라인 편집 / 휴지통**
  - 하단 플로팅 퀵 캡처 바 + 클립보드 링크 포착 칩 + `FIELD` 에러 캡션 + 문두 `@카테고리` 즉시 반영
  - React 19 `useOptimistic` / TanStack Query 낙관적 갱신 기반 `POST/PATCH/DELETE/restore` 연동, 인라인 본문 편집, 비동기 AI 분류/OGP 완료 백그라운드 동기화 및 150ms 레이아웃 애니메이션
- [x] **3-5. 하이브리드 검색, 연관 메모 1-Depth 필터 & 0ms 카테고리 시트/병합 제안**
  - 상단 헤더 검색바 (`GET /api/v1/memos/search` 하이브리드 검색 + IME 조합 입력 방어 + `Cmd+K` 단축키)
  - 메모 카드 하단 `관련 메모 N건` 칩 (`GET /api/v1/memos/:id/related`) 및 상단 필터 배너 라이브 전환
  - `match-sorter` 기반 0ms 카테고리 변경 시트(새 카테고리 생성/변경) & AI 유사 카테고리 병합 제안 카드(`GET/POST/DELETE merge-suggestions`) 연동
- [x] **3-6. 안드로이드 웹뷰 네이티브 브릿지 & 조건부 스플래시 / 오프라인 커스텀 뷰 (Capacitor)**
  - 안드로이드 텍스트/링크 Share Intent (공유하기 타깃) 수신 및 0.1초 퀵 캡처 자동 주입
  - 안드로이드 물리 뒤로가기 제스처 / 뒤로가기 키 바인딩 (사이드바 드로어 ➔ 카테고리 시트 ➔ 검색 뷰 ➔ 홈 ➔ 앱 종료 팝업 순차 레이어 닫힘)
  - 조건부 스플래시 (정상 진입 시 0ms 즉시 스킵 / 백엔드 지연 시에만 노출) 및 네트워크 단절 시 브랜드 오프라인 안내 뷰

---

## 🧠 4단계: 지식 그래프 & AI 에이전트 확장

- **목표**: 0.1초 퀵 캡처 철학을 유지하면서, 메모 간 능동적 연결(제텔카스텐 지식망)과 외부 AI 클라이언트 연동(MCP)으로 개인 지식 서재를 확장합니다.
- **주요 산출물**: `react-force-graph-2d` 기반 지식망 듀얼 모드 UI, Ideamory MCP 서버(`apps/api` `/mcp` 또는 `apps/mcp`) 및 PAT 인증

- [x] **4-1. Zero-Effort AI 제텔카스텐 (지식망 모드) 구현**
  - 신규 테이블(`memo_links`) 및 수동 링크/MOC 작성 배제 (Zero-DB Migration, 기존 Gemini 768차원 임베딩 코사인 유사도 0.8 데이터 100% 재활용)
  - `react-force-graph-2d` 기반 듀얼 모드(`[캐시 모드]` ⇄ `[지식망 모드]`) 1-Click 토글 및 `localStorage` 기반 상태 영속화 (앱/탭 재진입 시 0ms 뷰 복원)
  - 지식망 모드에서도 하단 썸존 퀵 캡처 바 상시 고정 (조망 중 0.1초 즉시 캡처 보장)
  - 연결도(유사도) 실시간 제어 슬라이더 (`threshold`: `0.70 ~ 0.85`, 기본 `0.80`)
  - 1-Depth 탭 포커스/하이라이트 + 하단 미니 카드 시트 슬라이딩 팝업 및 연속 탭 시 생각 꼬리물기(Breadcrumb) 지원
  - 캐시 모드(세로 고정) vs 지식망 모드(안드로이드 웹뷰 네이티브 화면 가로 회전 Auto-Rotate 지원) 분기
- [x] **4-2. Ideamory MCP(Model Context Protocol) 서버 & API 키 발급 바텀시트 구축**
  - 사이드바 드로어 내 `[AI 에이전트 연동 (MCP 키 관리)]` 메뉴 및 1-Depth 바텀시트(`mcp-key-sheet`) UI 구현
  - 허용 기능(`Scope`: `READ`, `WRITE`) 체크 및 캡처 시 강제 고정할 카테고리(`Fixed Category`) 지정 기능 구현
  - `mcp_api_keys` 테이블(UUID v7, SHA-256 해시, `scopes`, `fixed_category_name`) 및 발급/재발급/삭제 API 연동
  - 기존 `MemoService`, `CategoryService`를 100% 재사용한 경량 Remote MCP 엔드포인트 또는 `apps/mcp` 어댑터 패키징
  - 외부 AI 클라이언트(Claude Desktop, Cursor 등) 연동용 `apps/mcp/README.md` 가이드 문서(JSON 설정 예시) 완비

---

## 🚀 5단계: 엔드투엔드 연동 테스트 및 배포

- **목표**: 확장 기능(제텔카스텐 · MCP)을 포함한 분산 환경 신뢰성을 검증하고 3-Tier 인프라에 배포를 완료합니다.
- **주요 산출물**: CI/CD 파이프라인, E2E 테스트 보고서, 프로덕션 배포 환경

- [x] **5-1. 3-Tier 인프라 연동 및 네트워크/보안 검증**
  - `Vercel` (프론트) ➔ `Northflank` (백엔드) ➔ `Supabase` (DB) 간 CORS 및 보안 헤더 검증
  - 엔드투엔드 `X-Trace-Id` 분산 추적 로그 정상 수집 확인
- [x] **5-2. 화면(UI) 기능 점검 및 Supabase MCP DB 정합성 N차 통합 테스트**
  - API·로그 단위 검증은 기존 백엔드 테스트 스위트로 갈음하고, 실제 웹/모바일 화면에서 전체 UI/UX 및 핵심 기능(퀵 캡처, `@카테고리`, AI/OGP 파이프라인, 하이브리드 검색, 연관 메모, 병합 제안, 휴지통, 제텔카스텐/MCP 연동) 전수 점검
  - Supabase MCP를 통해 실제 DB(`memos`, `categories`, `ogp_caches`, `category_merge_suggestions`, `mcp_api_keys`) 적재·갱신·삭제 값 교차 검증 (`integration-tests/` 시나리오 기준 Round 1·2 완료, 이슈 0건 달성)
- [x] **5-3. 게스트/회원 라이프사이클 DB 무결성 및 증적(스크린샷·README 영상) 마감**
  - 게스트 데이터 초기화(Hard Delete), 소셜 계정 데이터 이관 및 회원탈퇴 화면 플로우 + Supabase MCP DB 무결성 검증
  - 회차별 통합 테스트 결과서(`round-1-report.md`, `round-2-report.md`)·스크린샷 증적 정리 및 GitHub README 첨부용 주요 기능 시연 영상(`.webm` 5종) 녹화 완료

---

## 💡 6단계: AI 브레인 어시스턴트 고도화 (AI 메모 검색 RAG 모드)

- **목표**: 썸존 듀얼 인터랙션(`[AI]` 토글)과 기존 768차원 임베딩/하이브리드 검색을 결합하여, 사용자의 질문에 내 메모를 엮어 즉시 핵심을 떠먹여 주는 RAG 기능을 완성합니다.
- **주요 산출물**: 썸존 `[AI]` 토글 바 및 포커스 모드 헤더, `POST /api/v1/memos/ai-search` 엔드포인트, 단일 브리핑 교체(Single-Briefing Replace) 카드 UI

- [x] **6-1. 백엔드 Gemini RAG 검색 파이프라인 구축**
  - `AiSearchRequestDto(query: string)` 및 `AiSearchResponseDto(answer, sources)` Zod 스키마 정의
  - 기존 `search_memos_hybrid` 상위 3~5건 추출 ➔ Gemini 1.5/Flash 프롬프트 바인딩 ➔ 2~3줄 핵심 브리핑 생성 서비스 로직 구현
  - `POST /api/v1/memos/ai-search` 컨트롤러 및 단위 테스트 완비
- [x] **6-2. 프론트엔드 썸존 `[AI]` 토글 & 포커스 헤더 단일 브리핑 UI 구축**
  - 하단 썸존 좌측 `[AI]` 토글 버튼 및 우측 버튼 모핑(`[+]` ⇄ `[🔍]`) 구현
  - AI 모드 활성화 시 상단 일반 검색바 ➔ `[← 뒤로가기]` + AI 검색 미니멀 포커스 헤더 150ms 모핑 연동
  - AI 브리핑 카드 및 1-Depth 근거 메모 카드 목록 렌더링
  - 연속 질문 시 기존 카드를 최신 브리핑으로 100% 덮어쓰기 교체(Single-Briefing Replace) 인터랙션 구현
  - 상단 `[←]` 터치, `[AI]` 토글 해제 및 안드로이드 뒤로가기 시 0ms 타임라인 복귀 연동

---

## 📌 개발 원칙 및 컨벤션 바로가기
- **디렉터리 구조**: FSD (Feature-Sliced Design) 아키텍처 준수 (`shared` ➔ `entities` ➔ `features` ➔ `app`)
- **명명 규칙**: 파일/폴더 `kebab-case`, 컴포넌트/타입 `PascalCase`, 함수/변수 `camelCase`
- **커밋 메시지**: 명확한 타입(`feat:`, `fix:`, `refactor:`) 및 한글 상세 작업 내역 명시
- **로깅 규칙**: 모든 백엔드 요청에 `X-Trace-Id`를 추적하고 민감 정보 마스킹 필수
