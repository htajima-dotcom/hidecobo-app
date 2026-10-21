import Link from "next/link";
import { currentPayDate, requireRole } from "@/lib/me";
import { createRun } from "../actions";
import { TopBar } from "../../nav";

export default async function PayrollRuns({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const me = await requireRole("admin");
  const { data: runs } = await me.supabase.from("payroll_runs").select("id, pay_date, label, status, confirmed_at").order("pay_date", { ascending: false });

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <p><Link href="/admin">← 管理</Link></p>
        <h1>給与計算</h1>
        {msg ? <p className="card">{msg}</p> : null}
        <form action={createRun} className="card inline">
          <label>支給日 <input type="date" name="payDate" defaultValue={currentPayDate()} required /></label>
          <button className="primary">この月度を計算する</button>
          <p className="muted" style={{ width: "100%", margin: 0 }}>前月26日〜当月25日の勤怠を集計し、全員の給与を下書きで計算します。確定するまで本人には見えません。</p>
        </form>
        <div className="table-wrap card">
          <table>
            <thead><tr><th>支給日</th><th>月度</th><th>状態</th><th></th></tr></thead>
            <tbody>
              {(runs ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.pay_date.replace(/-/g, "/")}</td>
                  <td>{r.label}</td>
                  <td><span className="badge">{r.status === "confirmed" ? "確定" : "下書き"}</span></td>
                  <td><Link href={`/admin/payroll/${r.id}`}>開く</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
