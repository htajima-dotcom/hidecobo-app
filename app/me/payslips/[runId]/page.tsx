import Link from "next/link";
import { notFound } from "next/navigation";
import type { MonthlyInput, PayrollResult } from "@/src/payroll";
import { getMe } from "@/lib/me";
import { PayslipView } from "@/components/payslip-view";
import { TopBar } from "../../../nav";

export default async function MyPayslip({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const me = await getMe();
  if (!me.employee) notFound();
  // 確定した本人分だけがデータベースの権限で返る
  const { data: s } = await me.supabase.from("payslips").select("input, result, payroll_runs(pay_date, label)").eq("run_id", runId).eq("employee_id", me.employee.id).maybeSingle();
  if (!s) notFound();
  const run = s.payroll_runs as unknown as { pay_date: string; label: string };
  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <p><Link href="/me/payslips">← 給与明細の一覧</Link></p>
        <h1>{run.label} 給与明細（{run.pay_date.replace(/-/g, "/")} 支給）</h1>
        <p className="muted">{me.employee.name} 様</p>
        <PayslipView input={s.input as MonthlyInput} result={s.result as PayrollResult} />
      </main>
    </>
  );
}
