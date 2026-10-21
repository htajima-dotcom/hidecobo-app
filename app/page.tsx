import { getMe, todayJst } from "@/lib/me";
import { TopBar } from "./nav";
import { PunchButtons } from "./punch-buttons";

export default async function Home() {
  const me = await getMe();
  const today = todayJst();
  const { data: day } = me.employee
    ? await me.supabase.from("attendance_days").select("status, clock_in, clock_out").eq("employee_id", me.employee.id).eq("work_date", today).maybeSingle()
    : { data: null };
  const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "―");

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>{today.replace(/-/g, "/")} の打刻</h1>
        {me.employee ? (
          <div className="card">
            <p>
              出勤 <strong>{hhmm(day?.clock_in)}</strong>　退勤 <strong>{hhmm(day?.clock_out)}</strong>
            </p>
            <PunchButtons hasIn={!!day?.clock_in} hasOut={!!day?.clock_out} />
            <p className="muted">打ち忘れや間違いは「自分の勤怠」から修正を申請してください。</p>
          </div>
        ) : (
          <p className="muted">従業員として登録されていないため、打刻はできません。</p>
        )}
      </main>
    </>
  );
}
