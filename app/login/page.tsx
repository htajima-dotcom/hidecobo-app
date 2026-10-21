"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 社長が招待したメールアドレスにだけログイン用のリンクを送る（新規登録はできない）
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <main>
      <h1>ヒデ工房 勤怠・給与</h1>
      <div className="card">
        {state === "sent" ? (
          <p>ログイン用のリンクをメールで送りました。メールを開いてリンクを押してください。</p>
        ) : (
          <form className="inline" onSubmit={send}>
            <input type="email" required placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="primary" type="submit">ログイン用のリンクを送る</button>
          </form>
        )}
        {state === "error" ? <p className="error">送れませんでした。登録済みのメールアドレスか確認してください。</p> : null}
      </div>
    </main>
  );
}
