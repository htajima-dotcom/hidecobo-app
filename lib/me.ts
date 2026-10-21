import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "admin" | "accounting" | "staff";

/** ログイン中の人の役割と従業員情報。登録されていなければログイン画面へ */
export async function getMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("members").select("role, display_name").eq("user_id", user.id).single();
  const { data: employee } = await supabase.from("employees").select("id, name, pay_type").eq("user_id", user.id).maybeSingle();
  return { supabase, user, role: (member?.role ?? null) as Role | null, name: member?.display_name ?? user.email, employee };
}

export async function requireRole(...roles: Role[]) {
  const me = await getMe();
  if (!me.role || !roles.includes(me.role)) redirect("/");
  return me;
}

/** 日本時間の今日（YYYY-MM-DD） */
export const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** 支給日から月度の対象期間（前月26日〜当月25日） */
export function periodOf(payDate: string): { from: string; to: string } {
  const [y, m] = payDate.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 26)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m - 1, 25)).toISOString().slice(0, 10);
  return { from: prev, to: end };
}

export const yen = (n: number | null | undefined) => (typeof n === "number" ? `${n.toLocaleString("ja-JP")}円` : "―");

/** 今日が属する月度の支給日（26日以降は翌月度） */
export function currentPayDate(today = todayJst()): string {
  const [y, m, d] = today.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + (d > 25 ? 1 : 0) + 1, 0));
  return end.toISOString().slice(0, 10);
}

/** 支給日を前後の月度へずらす */
export function shiftPayDate(payDate: string, months: number): string {
  const [y, m] = payDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months + 1, 0)).toISOString().slice(0, 10);
}

export const monthLabel = (payDate: string) => `${Number(payDate.slice(5, 7))}月度`;
