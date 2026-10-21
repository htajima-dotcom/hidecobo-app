import Link from "next/link";
import { requireRole, todayJst } from "@/lib/me";
import { TopBar } from "../nav";

export default async function AdminHome() {
  const me = await requireRole("admin");
  const today = todayJst();
  const [{ data: employees }, { data: days }, { count: pending }] = await Promise.all([
    me.supabase.from("employees").select("id, employee_no, name, contract, retired_on").order("employee_no"),
    me.supabase.from("attendance_days").select("employee_id, status, clock_in, clock_out").eq("work_date", today),
    me.supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "申請中"),
  ]);
  const active = (employees ?? []).filter((e) => !e.retired_on || e.retired_on >= today);
  const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>管理</h1>
        <div className="card inline" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/admin/requests">申請の承認{pending ? `（${pending}件）` : ""}</Link>
          <Link className="button" href="/admin/payroll">給与計算</Link>
          <Link className="button" href="/accounting">経理（給与仕訳）</Link>
          <Link className="button" href="/admin/members">ログインできる人</Link>
        </div>

        <h2>今日の出勤状況（{today.replace(/-/g, "/")}）</h2>
        <div className="table-wrap card">
          <table>
            <thead><tr><th>No</th><th>氏名</th><th>契約</th><th>区分</th><th>出勤</th><th>退勤</th></tr></thead>
            <tbody>
              {active.map((e) => {
                const d = days?.find((x) => x.employee_id === e.id);
                return (
                  <tr key={e.id}>
                    <td>{e.employee_no}</td>
                    <td>{e.name}</td>
                    <td>{e.contract}</td>
                    <td>{d?.status ?? ""}</td>
                    <td>{hhmm(d?.clock_in)}</td>
                    <td>{hhmm(d?.clock_out)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
