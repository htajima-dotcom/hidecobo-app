import { getMe } from "@/lib/me";
import { changePassword } from "../../actions";
import { TopBar } from "../../nav";

export default async function Password({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const me = await getMe();
  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>パスワードの変更</h1>
        {msg ? <p className="card">{msg}</p> : null}
        <form action={changePassword} className="card" style={{ display: "grid", gap: 12, maxWidth: 360 }}>
          <input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="新しいパスワード（8文字以上）" />
          <input type="password" name="confirm" required minLength={8} autoComplete="new-password" placeholder="もう一度" />
          <button className="primary">変更する</button>
        </form>
      </main>
    </>
  );
}
