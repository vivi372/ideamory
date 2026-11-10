import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트 팩토리 (백엔드 전용)
 */
export function createSupabaseServiceClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

