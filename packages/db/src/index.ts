import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 서버 클라이언트 팩토리 (백엔드 전용)
 * Supabase API Keys v2의 Secret Key 또는 레거시 service_role Key를 수용합니다.
 */
export function createSupabaseServiceClient(supabaseUrl: string, secretKey: string) {
  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

