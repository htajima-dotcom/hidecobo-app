import Link from "next/link";
import type { PayrollResult } from "@/src/payroll";
import { getMe, yen } from "@/lib/me";
import { TopBar } from "../../nav";

export default async function MyPayslips() {
  const me = await getMe();
  const { data } = me.employee
    ? await me.supabase.from("payslips").select("run_id, result, payroll_runs(pay_date, label)").eq("employee_id", me.employee.id)
    : { data: [] };
  const slips = (data ?? [])
    .map((s) => ({ ...s, run: s.payroll_runs as unknown as { pay_date: string; label: string } }))
    .sort((a, b) => b.run.pay_date.localeCompare(a.run.pay_date));

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>給与明細</h1>
        {slips.length ? (
          <div className="table-wrap card">
            <table>
              <thead><tr><th>支給日</th><th>月度</th><th className="num">総支給</th><th className="num">差引支給</th><th></th></tr></thead>
              <tbody>
                {slips.map((s) => {
                  const r = s.result as PayrollResult;
                  return (
                    <tr key={s.run_id}>
                      <td>{s.run.pay_date.replace(/-/g, "/")}</td>
                      <td>{s.run.label}</td>
                      <td className="num">{yen(r.grossPay)}</td>
                      <td className="num">{yen(r.netPay)}</td>
                      <td><Link href={`/me/payslips/${s.run_id}`}>明細を見る</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">確定した給与明細はまだありません。</p>
        )}
      </main>
    </>
  );
}
