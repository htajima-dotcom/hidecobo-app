import Link from "next/link";
import { requireRole } from "@/lib/me";
import { decideRequest } from "../actions";
import { TopBar } from "../../nav";

const describe = (kind: string, d: { in?: string | null; out?: string | null; half?: string }) =>
  kind === "打刻修正" ? `出勤 ${d.in ?? "変更なし"} / 退勤 ${d.out ?? "変更なし"}` : kind === "半休" ? `${d.half ?? "午前"}休` : "終日";

export default async function Requests({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const me = await requireRole("admin");
  const { data: reqs } = await me.supabase
    .from("requests")
    .select("id, kind, target_date, detail, reason, status, created_at, employees(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  const open = (reqs ?? []).filter((r) => r.status === "申請中");
  const done = (reqs ?? []).filter((r) => r.status !== "申請中");
  const name = (r: { employees: unknown }) => (r.employees as { name: string } | null)?.name ?? "";

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <p><Link href="/admin">← 管理</Link></p>
        <h1>申請の承認</h1>
        {msg ? <p className="card">{msg}</p> : null}
        {open.length ? (
          open.map((r) => (
            <div key={r.id} className="card">
              <strong>{name(r)}</strong>　{r.kind}　{String(r.target_date).replace(/-/g, "/")}　{describe(r.kind, r.detail ?? {})}
              {r.reason ? <p className="muted">理由: {r.reason}</p> : null}
              <form action={decideRequest} className="inline">
                <input type="hidden" name="id" value={r.id} />
                <button className="primary" name="decision" value="承認">承認して反映</button>
                <button name="decision" value="却下">却下</button>
              </form>
            </div>
          ))
        ) : (
          <p className="muted">処理待ちの申請はありません。</p>
        )}
        {done.length ? (
          <>
            <h2>処理済み（最近50件まで）</h2>
            <div className="table-wrap card">
              <table>
                <thead><tr><th>氏名</th><th>種類</th><th>対象日</th><th>内容</th><th>結果</th></tr></thead>
                <tbody>
                  {done.map((r) => (
                    <tr key={r.id}>
                      <td>{name(r)}</td>
                      <td>{r.kind}</td>
                      <td>{String(r.target_date).replace(/-/g, "/")}</td>
                      <td>{describe(r.kind, r.detail ?? {})}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
