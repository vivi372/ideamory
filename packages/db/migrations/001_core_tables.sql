-- ============================================================================
-- Ideamory (아이디모리) 핵심 테이블 DDL 마이그레이션 스크립트 (001_core_tables.sql)
-- 대상: categories (카테고리), ogp_caches (공유 OGP 캐시), memos (메모)
-- ============================================================================

-- 1. 확장 기능 (Extensions Setup) 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- 2. 카테고리 테이블 (categories)
-- 사용자의 메모를 그룹화하는 미니멀 텍스트 배지
-- 이모지 배제, 1~10자 제약, 공백 정규화(normalized_name) 유니크 키 관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY, -- NestJS 백엔드에서 선발급한 UUID v7
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 소셜 연동 사용자 (회원탈퇴 시 연쇄 삭제)
    guest_token VARCHAR(64), -- 익명 게스트 세션 식별 토큰
    name VARCHAR(10) NOT NULL, -- 표출용 카테고리명 (최대 10자, 이모지 배제)
    normalized_name VARCHAR(10) NOT NULL, -- 공백 제거 정규화 키 (replace(/\s+/g, ''))
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 소셜 유저와 익명 게스트 간 배타적 소유권 검증 (둘 중 정확히 하나만 존재해야 함)
    CONSTRAINT chk_categories_owner CHECK (
        (user_id IS NOT NULL AND guest_token IS NULL) OR
        (user_id IS NULL AND guest_token IS NOT NULL)
    ),

    -- 카테고리 글자 수 제약 (1자 이상 10자 이하)
    CONSTRAINT chk_categories_name_length CHECK (
        char_length(name) >= 1 AND char_length(name) <= 10
    )
);

-- 카테고리 인덱스 설정
-- 1) 소셜 유저 카테고리 공백 정규화 유니크 부분 인덱스 (띄어쓰기 파편화 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_normalized
    ON public.categories (user_id, normalized_name)
    WHERE user_id IS NOT NULL;

-- 2) 게스트 카테고리 공백 정규화 유니크 부분 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_guest_normalized
    ON public.categories (guest_token, normalized_name)
    WHERE guest_token IS NOT NULL;


-- ============================================================================
-- 3. Open Graph 공유 캐시 테이블 (ogp_caches)
-- 메모 본문 첫 번째 URL 중심의 N:1 전역 공유 캐시
-- 기본 14일 TTL 만료 정책 (온보딩 시드 가이드는 100년 영구 만료)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ogp_caches (
    id UUID PRIMARY KEY, -- UUID v7 고유 식별자
    target_url TEXT NOT NULL UNIQUE, -- 크롤링 대상 원본 URL (공유 검색 키)
    title TEXT, -- OGP 메타데이터 제목
    thumbnail_url TEXT, -- OGP 썸네일 이미지 URL
    description TEXT, -- OGP 메타데이터 요약 설명
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 최초 크롤링 일시
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'), -- 캐시 만료 일시
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OGP 캐시 인덱스 설정
-- 1) target_url 고유 검색 유니크 인덱스 (조회 0ms 캐시 히트)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ogp_caches_target_url
    ON public.ogp_caches (target_url);

-- 2) 만료 스케줄러 배치 청소용 인덱스
CREATE INDEX IF NOT EXISTS idx_ogp_caches_expires_at
    ON public.ogp_caches (expires_at);


-- ============================================================================
-- 4. 메모 테이블 (memos)
-- 0.1초 퀵 캡처 본문, 매핑 카테고리, Gemini 768차원 임베딩, 공유 OGP, 30일 Soft Delete 관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.memos (
    id UUID PRIMARY KEY, -- NestJS 백엔드에서 선발급한 UUID v7
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 소셜 연동 사용자 (회원탈퇴 시 연쇄 삭제)
    guest_token VARCHAR(64), -- 익명 게스트 세션 식별 토큰
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT, -- 메모가 속한 카테고리는 임의 삭제 차단
    ogp_id UUID REFERENCES public.ogp_caches(id) ON DELETE SET NULL, -- OGP 캐시 만료 삭제 시 메모는 보존되고 NULL 처리
    content TEXT NOT NULL, -- 메모 본문 텍스트 (최대 5,000자)
    embedding VECTOR(768), -- Google Gemini text-embedding-004 768차원 임베딩 벡터
    deleted_at TIMESTAMPTZ, -- Soft Delete 일시 (30일 휴지통 보관)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 소셜 유저와 익명 게스트 간 배타적 소유권 검증 (둘 중 정확히 하나만 존재해야 함)
    CONSTRAINT chk_memos_owner CHECK (
        (user_id IS NOT NULL AND guest_token IS NULL) OR
        (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

-- 메모 인덱스 설정
-- 1) 소셜 유저 메인 타임라인 최신순 정렬 B-Tree 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_user_timeline
    ON public.memos (user_id, deleted_at, created_at DESC)
    WHERE user_id IS NOT NULL;

-- 2) 게스트 메인 타임라인 최신순 정렬 B-Tree 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_guest_timeline
    ON public.memos (guest_token, deleted_at, created_at DESC)
    WHERE guest_token IS NOT NULL;

-- 3) 키워드 풀텍스트 검색(FTS) GIN 인덱스 (simple 파서 기반 한글/영문 검색)
CREATE INDEX IF NOT EXISTS idx_memos_fts
    ON public.memos USING gin (to_tsvector('simple', content));

-- 4) Google Gemini 768차원 임베딩 코사인 유사도 연산 HNSW 인덱스 (m=16, ef_construction=64)
CREATE INDEX IF NOT EXISTS idx_memos_embedding_hnsw
    ON public.memos USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

