import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * ログインの登録・パスワード再発行だけに使う、全権限のクライアント。
 * 呼ぶ前に必ず requireRole("admin") で権限者かを確かめること。鍵はサーバーの環境変数だけに置く。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** 読み間違えにくい文字だけの仮パスワード */
export function temporaryPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
