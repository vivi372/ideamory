# 📋 Ideamory 개발 실행 플랜 및 진행도 체크리스트 (v2.0)

> **프로젝트**: Ideamory (아이디모리) — 모바일 퍼스트 0.1초 퀵 캡처 & AI 하이브리드 지식 서재  
> **아키텍처**: Monorepo (Turborepo + pnpm workspaces)  
> **핵심 스택**: Next.js 15 (React 19) + NestJS + PostgreSQL 17 (Drizzle ORM, postgres.js, pgvector) + Supabase Auth (jose ES256) + Gemini AI  
> **최근 업데이트**: 2026-11-12 (Drizzle ORM 풀링 및 jose ECC P-256 아키텍처 개정 반영)  

---

## 📊 종합 진행 현황 (Progress Dashboard)

| 단계 | 구분 | 목표 및 핵심 영역 | 진행 상태 | 완료율 |
| :---: | :--- | :--- | :---: | :---: |
| **0단계** | **기반 환경** | Monorepo 구성 및 공통 Config 설정 | ✅ 완료 | `3 / 3` (100%) |
| **1단계** | **공통 모듈** | PostgreSQL DDL, Drizzle ORM 매핑, 인덱스, DTO 규격 | ✅ 완료 | `4 / 4` (100%) |
| **2단계** | **백엔드 API** | NestJS 코어 비즈니스, AI 임베딩, 검색, 캡처 | 🔄 진행중 | `3 / 6` (50.0%) |
| **3단계** | **프론트엔드** | Next.js 15 UI/UX, 썸존 퀵 캡처, 타임라인, 애니메이션 | ⏳ 준비 | `0 / 8` (0%) |
| **4단계** | **E2E & 배포** | 3-Tier 통합 연동, 분산 트레이싱, 무결성 검증 | ⏳ 준비 | `0 / 3` (0%) |
| **전체** | **Total** | **엔드투엔드 프로덕션 릴리스** | **진행중** | **`10 / 24` (41.7%)** |

```
진행률: [====================----------------------------] 41.7%
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
- [ ] **2-4. 메모 코어 파이프라인 & OGP 크롤러 (Core)**
  - 0.1초 퀵 캡처 API (UUID v7 선발급 즉시 선응답, 인라인 `@카테고리` 태그 자동 파싱, Gemini 768차원 임베딩 비동기 이벤트 발행)
  - 메모 타임라인 조회 (커서 기반 페이지네이션), 실수 방지 소프트 삭제(`deleted_at`) 및 원클릭 복구 API
  - 링크 포함 시 OGP 비동기 메타데이터 파싱 및 14일 TTL 캐싱/만료 크론 스케줄러
- [ ] **2-5. 카테고리 관리 & AI 유사 카테고리 통합 API**
  - 텍스트 전용 카테고리 CRUD (글자수/소유권 제약 준수)
  - AI 임베딩 유사도 기반 중복/유사 카테고리 탐지 및 원클릭 병합 기능
- [ ] **2-6. AI 하이브리드 검색 & 연관 메모 추천 엔진**
  - Drizzle Raw SQL 기반 키워드 FTS(0.4) + 의미 Vector(0.6) 가중치 결합 하이브리드 검색 쿼리
  - 특정 메모 기준 코사인 거리 기반 연관 메모 1-Depth 추천 엔드포인트

---

## 🎨 3단계: React / Next.js 프론트엔드 핵심 UI/UX 개발 (`apps/web/`)

- **목표**: 2026 UI/UX 트렌드와 모바일 퍼스트 썸존(Thumb-Zone) 중심의 초고속 인터페이스를 구현합니다.
- **주요 산출물**: FSD 아키텍처 기반 페이지, 컴포넌트, 낙관적 UI, 커맨드 팔레트

- [ ] **3-1. 공통 REST API 클라이언트 및 에러 인터셉터**
  - Axios 인스턴스 구축 및 `X-Trace-Id` 헤더 자동 주입
  - 백엔드 UX 태그와 연계된 전역 에러 핸들링
- [ ] **3-2. Radix Toast & Dialog 기반 피드백 시스템**
  - 비침습적 토스트 알림 (실행 취소 액션 지원)
  - 위험 작업(데이터 초기화, 탈퇴 등) 전용 확인 다이얼로그
- [ ] **3-3. 0.1초 퀵 캡처 하단 썸존(Thumb Zone) UI (Core)**
  - 한 손 조작에 최적화된 모바일 하단 플로팅 캡처 바
  - 클립보드 링크 감지 시 즉시 나타나는 "원클릭 링크 포착 칩"
- [ ] **3-4. 메모 타임라인 카드 UI 및 1-Depth 인라인 편집**
  - Bento Grid 모듈형 카드 레이아웃
  - 별도 페이지 이동 없는 즉각적인 1-Depth 인라인 텍스트 편집
  - 150ms 부드러운 레이아웃 전환 애니메이션
- [ ] **3-5. 낙관적 UI (Optimistic UI) 및 캐싱 파이프라인**
  - React 19 `useOptimistic` 및 TanStack Query v5 적용
  - 작성/수정/삭제 버튼 클릭 즉시 화면 갱신 후 백그라운드 서버 동기화
- [ ] **3-6. 연관 메모 N건 칩 및 1-Depth 타임라인 라이브 필터**
  - 메모 카드 하단에 연관 메모 개수 표시 뱃지 제공
  - 뱃지 클릭 시 메인 타임라인이 해당 연관 메모들로 즉시 필터링
- [ ] **3-7. 글로벌 검색바 및 0ms 인메모리 카테고리 피커**
  - `Cmd + K` 커맨드 팔레트 지원
  - `cmdk` + `match-sorter` 기반 타이핑 즉시 매칭되는 카테고리 실시간 추천
- [ ] **3-8. 반응형 내비게이션 및 모달 시스템**
  - 사이드바 드로어(모바일 햄버거 메뉴)
  - 계정 연동 바텀시트(Bottom Sheet) 및 인앱 오버레이 모달

---

## 🚀 4단계: 엔드투엔드 연동 테스트 및 배포

- **목표**: 분산 환경에서의 신뢰성을 검증하고 3-Tier 인프라에 배포를 완료합니다.
- **주요 산출물**: CI/CD 파이프라인, E2E 테스트 보고서, 프로덕션 배포 환경

- [ ] **4-1. 3-Tier 인프라 연동 및 네트워크/보안 검증**
  - `Vercel` (프론트) ➔ `Northflank` (백엔드) ➔ `Supabase` (DB) 간 CORS 및 보안 헤더 검증
  - 엔드투엔드 `X-Trace-Id` 분산 추적 로그 정상 수집 확인
- [ ] **4-2. 0.1초 퀵 캡처 ➔ AI 파이프라인 ➔ 하이브리드 검색 E2E 검증**
  - 메모 입력 ➔ 0.1초 선응답 ➔ 백그라운드 임베딩 생성 ➔ 하이브리드 검색 노출 전체 플로우 검증
- [ ] **4-3. 데이터 무결성 및 회원 라이프사이클 검증**
  - 게스트 데이터 원자적 초기화(Hard Delete) 무결성 확인
  - 게스트 ➔ 소셜 계정 데이터 이관 및 회원탈퇴 정상 처리 검증

---

## 📌 개발 원칙 및 컨벤션 바로가기
- **디렉터리 구조**: FSD (Feature-Sliced Design) 아키텍처 준수 (`shared` ➔ `entities` ➔ `features` ➔ `app`)
- **명명 규칙**: 파일/폴더 `kebab-case`, 컴포넌트/타입 `PascalCase`, 함수/변수 `camelCase`
- **커밋 메시지**: 명확한 타입(`feat:`, `fix:`, `refactor:`) 및 한글 상세 작업 내역 명시
- **로깅 규칙**: 모든 백엔드 요청에 `X-Trace-Id`를 추적하고 민감 정보 마스킹 필수
