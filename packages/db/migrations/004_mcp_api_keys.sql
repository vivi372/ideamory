-- 4-2. Ideamory MCP(Model Context Protocol) API 키 테이블 및 인덱스 생성
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_token VARCHAR(64) NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(16) NOT NULL,
    scopes VARCHAR(32)[] NOT NULL DEFAULT ARRAY['READ']::VARCHAR(32)[],
    fixed_category_name VARCHAR(10) NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_mcp_keys_owner CHECK (
        (user_id IS NOT NULL AND guest_token IS NULL) OR
        (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_keys_user
    ON public.mcp_api_keys (user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_keys_guest
    ON public.mcp_api_keys (guest_token)
    WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_keys_hash
    ON public.mcp_api_keys (key_hash);
