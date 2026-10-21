"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/me";
import { createAdminClient, temporaryPassword } from "@/lib/supabase/admin";

export type MemberResult = { message: string; password?: string; error?: boolean } | null;

const ROLES: Role[] = ["admin", "accounting", "staff"];

/** ログインできる人を登録し、仮パスワードを1回だけ表示する */
export async function addMember(_: MemberResult, form: FormData): Promise<MemberResult> {
  const me = await requireRole("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const displayName = String(form.get("displayName") ?? "").trim();
  const role = String(form.get("role")) as Role;
  const employeeId = String(form.get("employeeId") ?? "");
  if (!email || !displayName || !ROLES.includes(role)) return { message: "メールアドレス・氏名・役割を入れてください", error: true };

  const admin = createAdminClient();
  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { message: `登録できませんでした: ${error?.message ?? ""}（同じメールアドレスが登録済みかもしれません）`, error: true };

  const { error: e2 } = await me.supabase.from("members").insert({ user_id: data.user.id, role, display_name: displayName });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { message: `登録できませんでした: ${e2.message}`, error: true };
  }
  if (employeeId) await me.supabase.from("employees").update({ user_id: data.user.id }).eq("id", employeeId);
  revalidatePath("/admin/members");
  return { message: `${displayName} さんを登録しました。次の仮パスワードを本人に伝えてください（この画面を閉じると二度と表示されません）。`, password };
}

/** パスワードを忘れた人に、新しい仮パスワードを発行する */
export async function resetPassword(_: MemberResult, form: FormData): Promise<MemberResult> {
  await requireRole("admin");
  const userId = String(form.get("userId"));
  const password = temporaryPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { message: `再発行できませんでした: ${error.message}`, error: true };
  return { message: "新しい仮パスワードです。本人に伝えてください。", password };
}

/** 役割の変更と従業員の記録との結びつけ。自分自身の役割は変えられない（権限者がいなくなるのを防ぐ） */
export async function updateMember(form: FormData) {
  const me = await requireRole("admin");
  const userId = String(form.get("userId"));
  const role = String(form.get("role")) as Role;
  const employeeId = String(form.get("employeeId") ?? "");
  if (userId !== me.user.id && ROLES.includes(role)) {
    await me.supabase.from("members").update({ role }).eq("user_id", userId);
  }
  await me.supabase.from("employees").update({ user_id: null }).eq("user_id", userId);
  if (employeeId) await me.supabase.from("employees").update({ user_id: userId }).eq("id", employeeId);
  revalidatePath("/admin/members");
}
