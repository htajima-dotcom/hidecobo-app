"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 出勤・退勤の打刻。時刻はデータベース側（日本時間）で決まる */
export async function punch(kind: "in" | "out") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("punch", { kind });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

/** 打刻修正・有休・半休の申請。権限者が承認すると勤怠に反映される */
export async function submitRequest(form: FormData) {
  const supabase = await createClient();
  const { data: emp } = await supabase.rpc("my_employee_id");
  const kind = String(form.get("kind"));
  const detail =
    kind === "打刻修正" ? { in: form.get("in") || null, out: form.get("out") || null }
    : kind === "半休" ? { half: form.get("half") === "午後" ? "午後" : "午前" }
    : {};
  const { error } = await supabase.from("requests").insert({
    employee_id: emp,
    kind,
    target_date: String(form.get("date")),
    detail,
    reason: String(form.get("reason") ?? ""),
  });
  const back = `/me/attendance?pay=${form.get("pay") ?? ""}`;
  if (error) redirect(`${back}&msg=${encodeURIComponent("申請できませんでした: " + error.message)}`);
  revalidatePath("/me/attendance");
  redirect(`${back}&msg=${encodeURIComponent("申請しました。承認されると勤怠に反映されます。")}`);
}

export async function changePassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) redirect(`/me/password?msg=${encodeURIComponent("8文字以上にしてください")}`);
  if (password !== form.get("confirm")) redirect(`/me/password?msg=${encodeURIComponent("2回の入力が一致しません")}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  redirect(`/me/password?msg=${encodeURIComponent(error ? `変更できませんでした: ${error.message}` : "変更しました。次回から新しいパスワードでログインしてください。")}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
