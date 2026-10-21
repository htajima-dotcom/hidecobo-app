"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 権限者が登録したメールアドレスと、渡された仮パスワードでログインする（新規登録はできない）
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) return setError(true);
    router.replace("/");
    router.refresh();
  }

  return (
    <main>
      <h1>ヒデ工房 勤怠・給与</h1>
      <form className="card" onSubmit={login} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <input type="email" required autoComplete="username" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required autoComplete="current-password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="primary" type="submit" disabled={pending}>ログイン</button>
        {error ? <p className="error">ログインできませんでした。メールアドレスとパスワードを確かめてください。忘れたときは権限者に再発行を頼んでください。</p> : null}
      </form>
    </main>
  );
}
