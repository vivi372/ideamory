-- =====================================================================
-- 003_memo_ai_status.sql
-- memos.ai_status ('PENDING' | 'COMPLETED' | 'FAILED') 컬럼 추가 및 기존 '미분류' 데이터 정리
-- =====================================================================

-- 1. 기존 '미분류' 카테고리에 속한 메모 및 '미분류' 카테고리 일괄 삭제
DELETE FROM memos
WHERE category_id IN (
  SELECT id FROM categories WHERE normalized_name = '미분류'
);

DELETE FROM categories
WHERE normalized_name = '미분류';

-- 2. memos 테이블에 ai_status 컬럼 및 CHECK 제약조건 추가
ALTER TABLE memos
ADD COLUMN IF NOT EXISTS ai_status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
CONSTRAINT chk_memos_ai_status CHECK (ai_status IN ('PENDING', 'COMPLETED', 'FAILED'));

-- 3. 기존에 이미 분류되어 저장된 메모들은 'COMPLETED'로 일괄 보정
UPDATE memos
SET ai_status = 'COMPLETED'
WHERE ai_status = 'PENDING';
