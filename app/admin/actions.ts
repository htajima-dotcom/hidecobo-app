"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MonthlyInput } from "@/src/payroll";
import { monthLabel, requireRole } from "@/lib/me";
import { MANUAL_FIELDS, confirmRun, recalcRun } from "@/lib/payroll-run";

const back = (path: string, msg: string): never => redirect(`${path}?msg=${encodeURIComponent(msg)}`);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
// redirect() は例外で画面遷移を伝えるので、握りつぶさないよう try の外で呼ぶ

/** 申請の承認・却下。承認すると勤怠の日データへ反映する */
export async function decideRequest(form: FormData) {
  const me = await requireRole("admin");
  const id = String(form.get("id"));
  const approve = form.get("decision") === "承認";
  const { data: req } = await me.supabase.from("requests").select("employee_id, kind, target_date, detail, status").eq("id", id).single();
  if (!req || req.status !== "申請中") back("/admin/requests", "この申請はすでに処理されています");

  if (approve) {
    const detail = (req!.detail ?? {}) as { in?: string | null; out?: string | null; half?: string };
    const { data: day } = await me.supabase.from("attendance_days").select("status, clock_in, clock_out").eq("employee_id", req!.employee_id).eq("work_date", req!.target_date).maybeSingle();
    const row =
      req!.kind === "打刻修正"
        ? { status: day?.status || "出勤", clock_in: detail.in ?? day?.clock_in ?? null, clock_out: detail.out ?? day?.clock_out ?? null }
        : req!.kind === "有休"
          ? { status: "有休", clock_in: null, clock_out: null }
          : { status: detail.half === "午後" ? "午後有給" : "午前有給", clock_in: day?.clock_in ?? null, clock_out: day?.clock_out ?? null };
    const { error } = await me.supabase.from("attendance_days").upsert({ employee_id: req!.employee_id, work_date: req!.target_date, ...row, updated_by: me.user.id });
    if (error) back("/admin/requests", `勤怠に反映できませんでした: ${error.message}`);
  }
  await me.supabase.from("requests").update({ status: approve ? "承認" : "却下", decided_by: me.user.id, decided_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/requests");
  back("/admin/requests", approve ? "承認して勤怠に反映しました" : "却下しました");
}

/** 支給日を指定して月度（下書き）を作り、全員分を計算する */
export async function createRun(form: FormData) {
  const me = await requireRole("admin");
  const payDate = String(form.get("payDate"));
  const { data: run, error } = await me.supabase.from("payroll_runs").insert({ pay_date: payDate, label: monthLabel(payDate) }).select("id").single();
  if (error || !run) back("/admin/payroll", `作成できませんでした: ${error?.message}`);
  let msg = "計算しました";
  try {
    const warnings = await recalcRun(me.supabase, run!.id);
    if (warnings.length) msg += `（注意: ${warnings.join(" / ")}）`;
  } catch (e) {
    msg = `月度は作りましたが計算できませんでした: ${errorText(e)}`;
  }
  back(`/admin/payroll/${run!.id}`, msg);
}

export async function recalc(form: FormData) {
  const me = await requireRole("admin");
  const runId = String(form.get("runId"));
  let msg = "勤怠を集計し直して再計算しました";
  try {
    const warnings = await recalcRun(me.supabase, runId);
    if (warnings.length) msg += `（注意: ${warnings.join(" / ")}）`;
  } catch (e) {
    msg = errorText(e);
  }
  revalidatePath(`/admin/payroll/${runId}`);
  back(`/admin/payroll/${runId}`, msg);
}

/** その月だけの手入力（その他支給・控除など）を保存して再計算 */
export async function saveManual(form: FormData) {
  const me = await requireRole("admin");
  const runId = String(form.get("runId"));
  const employeeId = String(form.get("employeeId"));
  const { data: slip } = await me.supabase.from("payslips").select("input").eq("run_id", runId).eq("employee_id", employeeId).single();
  const input = { ...(slip?.input as MonthlyInput) };
  for (const [k] of MANUAL_FIELDS) {
    const v = String(form.get(k) ?? "").replace(/[,円\s]/g, "");
    if (v === "") delete input[k];
    else if (Number.isFinite(Number(v))) input[k] = Number(v);
  }
  const { error } = await me.supabase.from("payslips").update({ input }).eq("run_id", runId).eq("employee_id", employeeId);
  let msg = "保存して再計算しました";
  if (error) msg = error.message;
  else {
    try {
      await recalcRun(me.supabase, runId);
    } catch (e) {
      msg = errorText(e);
    }
  }
  revalidatePath(`/admin/payroll/${runId}`);
  back(`/admin/payroll/${runId}`, msg);
}

/** 確定：本人が明細を見られるようになり、給与仕訳が経理に渡る。確定後は変更できない */
export async function confirm(form: FormData) {
  const me = await requireRole("admin");
  const runId = String(form.get("runId"));
  let msg = "確定しました。明細が公開され、給与仕訳を作成しました";
  try {
    await confirmRun(me.supabase, runId, me.user.id);
  } catch (e) {
    msg = errorText(e);
  }
  revalidatePath(`/admin/payroll/${runId}`);
  back(`/admin/payroll/${runId}`, msg);
}
