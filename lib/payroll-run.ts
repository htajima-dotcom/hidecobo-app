import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePayroll, type CompanyRules, type EmployeeTerms, type MonthlyInput, type MonthSettings, type PayrollResult, type TaxTable } from "@/src/payroll";
import { summarizeAttendance, type AttendanceRules, type DayRecord } from "@/src/attendance";
import { buildPayrollJournal } from "@/src/accounting";
import { periodOf } from "./me";

/** 月ごとに手で入れる項目。再計算しても消さない */
export const MANUAL_FIELDS = [
  ["otherTaxable", "その他課税支給"],
  ["adjustmentOverride", "調整手当（この月だけ）"],
  ["commuteAdjustment", "通勤手当の調整"],
  ["incomeTaxManual", "源泉税（手入力）"],
  ["otherDeduction", "その他控除"],
] as const satisfies readonly (readonly [keyof MonthlyInput, string])[];

/** 支給日の月度について、勤怠を集計して全員の給与を計算し直す（下書きの間だけ） */
export async function recalcRun(supabase: SupabaseClient, runId: string): Promise<string[]> {
  const { data: run, error: runErr } = await supabase.from("payroll_runs").select("pay_date, status").eq("id", runId).single();
  if (runErr || !run) throw new Error("給与の月度が見つかりません");
  if (run.status !== "draft") throw new Error("確定済みの月度は計算し直せません");
  const payDate: string = run.pay_date;
  const { from, to } = periodOf(payDate);

  const { data: rate } = await supabase.from("rate_settings").select("settings").eq("pay_date", payDate).eq("status", "approved").maybeSingle();
  if (!rate) throw new Error(`${payDate} 支給分の料率（承認済み）が登録されていません`);
  const month = rate.settings as MonthSettings;
  const { data: rulesRow } = await supabase.from("company_rules").select("rules").lte("effective_from", payDate).order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (!rulesRow) throw new Error("会社の計算ルールが登録されていません");
  const { data: tax } = await supabase.from("tax_tables").select("table_data").eq("name", month.taxTable).maybeSingle();
  if (!tax) throw new Error(`源泉税額表「${month.taxTable}」が登録されていません`);

  const [{ data: employees }, { data: terms }, { data: days }, { data: prev }] = await Promise.all([
    supabase.from("employees").select("id, name, hired_on, retired_on, attendance_rules"),
    supabase.from("employment_terms").select("employee_id, effective_from, terms").lte("effective_from", payDate).order("effective_from", { ascending: false }),
    supabase.from("attendance_days").select("employee_id, work_date, status, clock_in, clock_out, break_minutes").gte("work_date", from).lte("work_date", to),
    supabase.from("payslips").select("employee_id, input").eq("run_id", runId),
  ]);

  const warnings: string[] = [];
  const rows = [];
  for (const e of employees ?? []) {
    if ((e.retired_on && e.retired_on < from) || (e.hired_on && e.hired_on > to)) continue;
    const t = terms?.find((x) => x.employee_id === e.id);
    if (!t) {
      warnings.push(`${e.name}: 労働条件が登録されていないため計算していません`);
      continue;
    }
    const empTerms = t.terms as EmployeeTerms;
    const records: DayRecord[] = (days ?? [])
      .filter((d) => d.employee_id === e.id)
      .map((d) => ({ date: d.work_date, status: d.status, in: d.clock_in, out: d.clock_out, breakMinutes: d.break_minutes }));
    const summary = summarizeAttendance(records, e.attendance_rules as AttendanceRules);
    const manual: MonthlyInput = {};
    const old = prev?.find((p) => p.employee_id === e.id)?.input as MonthlyInput | undefined;
    for (const [k] of MANUAL_FIELDS) if (old?.[k] != null) manual[k] = old[k];
    const input: MonthlyInput = { ...summary, ...manual };
    const result = calculatePayroll(empTerms, input, rulesRow.rules as CompanyRules, month, tax.table_data as TaxTable);
    rows.push({ run_id: runId, employee_id: e.id, input, result });
  }
  const { error } = await supabase.from("payslips").upsert(rows);
  if (error) throw new Error(error.message);
  return warnings;
}

/** 月度を確定し、給与仕訳（科目ごとの合計）を作る */
export async function confirmRun(supabase: SupabaseClient, runId: string, userId: string): Promise<void> {
  const { data: run } = await supabase.from("payroll_runs").select("pay_date, label, status").eq("id", runId).single();
  if (!run || run.status !== "draft") throw new Error("下書きの月度だけ確定できます");
  const { data: slips } = await supabase.from("payslips").select("input, result, employees(pay_type, contract)").eq("run_id", runId);
  if (!slips?.length) throw new Error("給与が計算されていません");
  const entry = buildPayrollJournal(
    run.pay_date,
    `${run.label} 給与`,
    slips.map((s) => {
      const emp = s.employees as unknown as { pay_type: EmployeeTerms["payType"]; contract: string };
      return { payType: emp.pay_type, contract: emp.contract, result: s.result as PayrollResult, otherDeduction: (s.input as MonthlyInput).otherDeduction };
    }),
  );
  const { error: e1 } = await supabase.from("payroll_runs").update({ status: "confirmed", confirmed_by: userId, confirmed_at: new Date().toISOString() }).eq("id", runId);
  if (e1) throw new Error(e1.message);
  await supabase.from("journal_entries").delete().eq("run_id", runId);
  const { error: e2 } = await supabase.from("journal_entries").insert({
    run_id: runId,
    entry_date: entry.date,
    description: entry.description,
    lines: { debits: entry.debits, credits: entry.credits },
  });
  if (e2) throw new Error(e2.message);
}
