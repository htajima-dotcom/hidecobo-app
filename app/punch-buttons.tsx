"use client";

import { useState, useTransition } from "react";
import { punch } from "./actions";

export function PunchButtons({ hasIn, hasOut }: { hasIn: boolean; hasOut: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (kind: "in" | "out") =>
    start(async () => {
      const r = await punch(kind);
      setMessage("error" in r && r.error ? r.error : kind === "in" ? "出勤を記録しました" : "退勤を記録しました");
    });
  return (
    <>
      <div className="punch">
        <button className="primary" disabled={pending || hasIn} onClick={() => run("in")}>出勤</button>
        <button className="primary" disabled={pending || !hasIn} onClick={() => run("out")}>{hasOut ? "退勤（打ち直し）" : "退勤"}</button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </>
  );
}
