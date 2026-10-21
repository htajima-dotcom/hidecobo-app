import Link from "next/link";
import { summarizeAttendance, type AttendanceRules } from "@/src/attendance";
import { currentPayDate, getMe, monthLabel, periodOf, shiftPayDate } from "@/lib/me";
import { submitRequest } from "../../actions";
import { TopBar } from "../../nav";

const WEEK = "日月火水木金土";
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export default async function MyAttendance({ searchParams }: { searchParams: Promise<{ pay?: string; msg?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  const pay = sp.pay && /^\d{4}-\d{2}-\d{2}$/.test(sp.pay) ? sp.pay : currentPayDate();
  const { from, to } = periodOf(pay);

  if (!me.employee) {
    return (
      <>
        <TopBar name={me.name} role={me.role} />
        <main><p className="muted">従業員として登録されていません。</p></main>
      </>
    );
  }

  const [{ data: days }, { data: emp }, { data: requests }] = await Promise.all([
    me.supabase.from("attendance_days").select("work_date, status, clock_in, clock_out").eq("employee_id", me.employee.id).gte("work_date", from).lte("work_date", to).order("work_date"),
    me.supabase.from("employees").select("attendance_rules").eq("id", me.employee.id).single(),
    me.supabase.from("requests").select("id, kind, target_date, status, reason, created_at").eq("employee_id", me.employee.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const byDate = new Map((days ?? []).map((d) => [d.work_date as string, d]));
  const sum = summarizeAttendance(
    (days ?? []).map((d) => ({ date: d.work_date, status: d.status, in: d.clock_in, out: d.clock_out })),
    (emp?.attendance_rules ?? {}) as AttendanceRules,
  );
  const dates: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 864e5) dates.push(new Date(t).toISOString().slice(0, 10));

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>自分の勤怠 {monthLabel(pay)}</h1>
        <p className="muted">
          {from.replace(/-/g, "/")}〜{to.replace(/-/g, "/")}　
          <Link href={`?pay=${shiftPayDate(pay, -1)}`}>← 前の月度</Link>　<Link href={`?pay=${shiftPayDate(pay, 1)}`}>次の月度 →</Link>
        </p>
        {sp.msg ? <p className="card">{sp.msg}</p> : null}

        <div className="card">
          出勤 {sum.workDays}日　所定 {sum.scheduledHours}時間　有休 {sum.paidLeaveDays}日　残業・休出 {sum.overtimeHours}時間　日曜 {sum.sundayHours}時間
          <p className="muted">給与の計算に使う集計です（確定前の目安）。</p>
        </div>

        <div className="table-wrap card">
          <table>
            <thead><tr><th>日付</th><th>区分</th><th>出勤</th><th>退勤</th></tr></thead>
            <tbody>
              {dates.map((d) => {
                const r = byDate.get(d);
                const w = new Date(`${d}T00:00:00Z`).getUTCDay();
                return (
                  <tr key={d}>
                    <td>{d.slice(5).replace("-", "/")}（{WEEK[w]}）</td>
                    <td>{r?.status ?? ""}</td>
                    <td>{hhmm(r?.clock_in)}</td>
                    <td>{hhmm(r?.clock_out)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2>修正・休みの申請</h2>
        <form action={submitRequest} className="card inline">
          <input type="hidden" name="pay" value={pay} />
          <select name="kind" defaultValue="打刻修正">
            <option>打刻修正</option>
            <option>有休</option>
            <option>半休</option>
          </select>
          <input type="date" name="date" required min={from} max={to} />
          <label>出勤 <input type="time" name="in" /></label>
          <label>退勤 <input type="time" name="out" /></label>
          <select name="half" defaultValue="午前" aria-label="半休の午前・午後">
            <option>午前</option>
            <option>午後</option>
          </select>
          <input name="reason" placeholder="理由（例：打ち忘れ）" />
          <button className="primary">申請する</button>
          <p className="muted" style={{ width: "100%", margin: 0 }}>出勤・退勤は打刻修正のとき、午前・午後は半休のときだけ使われます。</p>
        </form>

        {requests?.length ? (
          <div className="table-wrap card">
            <table>
              <thead><tr><th>申請日</th><th>種類</th><th>対象日</th><th>理由</th><th>状態</th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.created_at).slice(0, 10).replace(/-/g, "/")}</td>
                    <td>{r.kind}</td>
                    <td>{String(r.target_date).replace(/-/g, "/")}</td>
                    <td>{r.reason}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </>
  );
}
