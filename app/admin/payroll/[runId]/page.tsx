import Link from "next/link";
import { notFound } from "next/navigation";
import type { MonthlyInput, PayrollResult } from "@/src/payroll";
import { requireRole, yen } from "@/lib/me";
import { MANUAL_FIELDS } from "@/lib/payroll-run";
import { PayslipView } from "@/components/payslip-view";
import { confirm, recalc, saveManual } from "../../actions";
import { TopBar } from "../../../nav";

export default async function PayrollRun({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { runId } = await params;
  const { msg } = await searchParams;
  const me = await requireRole("admin");
  const { data: run } = await me.supabase.from("payroll_runs").select("id, pay_date, label, status").eq("id", runId).maybeSingle();
  if (!run) notFound();
  const { data: slips } = await me.supabase.from("payslips").select("employee_id, input, result, employees(employee_no, name, contract)").eq("run_id", runId);
  const rows = (slips ?? [])
    .map((s) => ({ ...s, emp: s.employees as unknown as { employee_no: string | null; name: string; contract: string }, r: s.result as PayrollResult, input: s.input as MonthlyInput }))
    .sort((a, b) => (a.emp.employee_no ?? "").localeCompare(b.emp.employee_no ?? "", "ja", { numeric: true }));
  const total = (k: keyof PayrollResult) => rows.reduce((a, s) => a + Number(s.r[k] ?? 0), 0);
  const draft = run.status === "draft";

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <p><Link href="/admin/payroll">← 給与計算</Link></p>
        <h1>{run.label}（{run.pay_date.replace(/-/g, "/")} 支給）<span className="badge">{draft ? "下書き" : "確定"}</span></h1>
        {msg ? <p className="card">{msg}</p> : null}

        {draft ? (
          <div className="card inline" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <form action={recalc}><input type="hidden" name="runId" value={runId} /><button>勤怠を集計し直す</button></form>
            <form action={confirm}><input type="hidden" name="runId" value={runId} /><button className="primary">社労士照合済み・確定する</button></form>
            <p className="muted" style={{ width: "100%", margin: 0 }}>確定すると本人が明細を見られるようになり、経理に給与仕訳が渡ります。確定後は変更できません。</p>
          </div>
        ) : null}

        <div className="table-wrap card">
          <table>
            <thead>
              <tr><th>No</th><th>氏名</th><th className="num">総支給</th><th className="num">社会保険</th><th className="num">雇用保険</th><th className="num">所得税</th><th className="num">住民税</th><th className="num">差引支給</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.employee_id}>
                  <td>{s.emp.employee_no}</td>
                  <td><a href={`#e-${s.employee_id}`}>{s.emp.name}</a></td>
                  <td className="num">{yen(s.r.grossPay)}</td>
                  <td className="num">{yen(s.r.healthInsurance + s.r.careInsurance + s.r.childSupport + s.r.pension)}</td>
                  <td className="num">{yen(s.r.employmentInsurance)}</td>
                  <td className="num">{yen(s.r.incomeTax)}</td>
                  <td className="num">{yen(s.r.residentTax)}</td>
                  <td className="num">{yen(s.r.netPay)}</td>
                </tr>
              ))}
              <tr>
                <th></th><th>合計</th>
                <th className="num">{yen(total("grossPay"))}</th>
                <th className="num">{yen(total("socialInsuranceTotal") - total("employmentInsurance"))}</th>
                <th className="num">{yen(total("employmentInsurance"))}</th>
                <th className="num">{yen(total("incomeTax"))}</th>
                <th className="num">{yen(total("residentTax"))}</th>
                <th className="num">{yen(total("netPay"))}</th>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>一人ずつの明細</h2>
        {rows.map((s) => (
          <details key={s.employee_id} id={`e-${s.employee_id}`} className="card">
            <summary><strong>{s.emp.name}</strong>　差引 {yen(s.r.netPay)}</summary>
            <PayslipView input={s.input} result={s.r} />
            {draft ? (
              <form action={saveManual} className="inline">
                <input type="hidden" name="runId" value={runId} />
                <input type="hidden" name="employeeId" value={s.employee_id} />
                {MANUAL_FIELDS.map(([k, label]) => (
                  <label key={k}>{label} <input name={k} inputMode="numeric" size={8} defaultValue={s.input[k] ?? ""} /></label>
                ))}
                <button>保存して再計算</button>
              </form>
            ) : null}
          </details>
        ))}
      </main>
    </>
  );
}
