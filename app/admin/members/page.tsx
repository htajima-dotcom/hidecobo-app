import Link from "next/link";
import { requireRole } from "@/lib/me";
import { TopBar } from "../../nav";
import { updateMember } from "./actions";
import { AddMemberForm, ResetPasswordForm } from "./forms";

const ROLE_LABEL = { admin: "権限者", accounting: "経理担当", staff: "スタッフ" } as const;

export default async function Members() {
  const me = await requireRole("admin");
  const [{ data: members }, { data: employees }] = await Promise.all([
    me.supabase.from("members").select("user_id, role, display_name").order("created_at"),
    me.supabase.from("employees").select("id, employee_no, name, user_id").order("employee_no"),
  ]);
  const unlinked = (employees ?? []).filter((e) => !e.user_id);

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <p><Link href="/admin">← 管理</Link></p>
        <h1>ログインできる人</h1>
        <p className="muted">
          権限者は全員の情報を見られ、設定を変えられます。経理担当は本人の勤怠・給与と給与仕訳（合計のみ）、スタッフは本人の分だけを見られます。
          スタッフは「従業員の記録」と結びつけると、打刻と明細が使えるようになります。
        </p>

        <h2>新しく登録する</h2>
        <AddMemberForm employees={unlinked} />

        <h2>登録済み</h2>
        {(members ?? []).map((m) => {
          const linked = employees?.find((e) => e.user_id === m.user_id);
          const self = m.user_id === me.user.id;
          return (
            <div key={m.user_id} className="card">
              <strong>{m.display_name}</strong>　<span className="badge">{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]}</span>
              <form action={updateMember} className="inline" style={{ marginTop: 8 }}>
                <input type="hidden" name="userId" value={m.user_id} />
                <select name="role" defaultValue={m.role} disabled={self} aria-label="役割">
                  <option value="staff">スタッフ</option>
                  <option value="accounting">経理担当</option>
                  <option value="admin">権限者</option>
                </select>
                <select name="employeeId" defaultValue={linked?.id ?? ""} aria-label="従業員の記録">
                  <option value="">従業員の記録なし</option>
                  {linked ? <option value={linked.id}>{linked.name}</option> : null}
                  {unlinked.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button>変更を保存</button>
                {self ? <span className="muted">自分の役割は、ほかの権限者が変更します</span> : null}
              </form>
              <div style={{ marginTop: 8 }}><ResetPasswordForm userId={m.user_id} /></div>
            </div>
          );
        })}
      </main>
    </>
  );
}
