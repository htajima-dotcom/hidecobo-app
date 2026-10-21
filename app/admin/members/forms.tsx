"use client";

import { useActionState } from "react";
import { addMember, resetPassword, type MemberResult } from "./actions";

function Result({ state }: { state: MemberResult }) {
  if (!state) return null;
  return (
    <div style={{ width: "100%" }}>
      <p className={state.error ? "error" : undefined}>{state.message}</p>
      {state.password ? <p className="secret">{state.password}</p> : null}
    </div>
  );
}

export function AddMemberForm({ employees }: { employees: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addMember, null);
  return (
    <form action={action} className="card inline">
      <input type="email" name="email" required placeholder="メールアドレス" />
      <input name="displayName" required placeholder="氏名（例：小前 太郎）" />
      <select name="role" defaultValue="staff">
        <option value="staff">スタッフ</option>
        <option value="accounting">経理担当</option>
        <option value="admin">権限者</option>
      </select>
      <select name="employeeId" defaultValue="">
        <option value="">従業員の記録と結びつけない</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <button className="primary" disabled={pending}>登録して仮パスワードを発行</button>
      <Result state={state} />
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button disabled={pending}>パスワード再発行</button>
      <Result state={state} />
    </form>
  );
}
