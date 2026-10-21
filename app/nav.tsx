import Link from "next/link";
import type { Role } from "@/lib/me";

export function TopBar({ name, role }: { name: string | null | undefined; role: Role | null }) {
  return (
    <header className="top">
      <strong>ヒデ工房</strong>
      <nav>
        <Link href="/">打刻</Link>
        <Link href="/me/attendance">自分の勤怠</Link>
        <Link href="/me/payslips">給与明細</Link>
        {role === "accounting" || role === "admin" ? <Link href="/accounting">経理</Link> : null}
        {role === "admin" ? <Link href="/admin">管理</Link> : null}
      </nav>
      <span className="muted">{name}</span>
    </header>
  );
}
