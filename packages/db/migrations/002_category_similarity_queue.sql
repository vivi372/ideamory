-- 2-5 후속: AI 유사 카테고리 탐지 및 제안 큐 파이프라인 스키마 마이그레이션

-- 1. categories 테이블에 768차원 임베딩 벡터 컬럼 추가
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 2. 유사 카테고리 병합 제안 큐 테이블 생성
CREATE TABLE IF NOT EXISTS public.category_merge_suggestions (
  id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_token VARCHAR(64) NULL,
  source_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  target_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  similarity DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_category_merge_suggestions_owner CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL) OR
    (user_id IS NULL AND guest_token IS NOT NULL)
  ),
  CONSTRAINT uq_category_merge_suggestions_pair UNIQUE (
    source_category_id, target_category_id
  )
);
