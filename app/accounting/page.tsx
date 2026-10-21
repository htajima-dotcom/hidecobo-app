import type { JournalLine } from "@/src/accounting";
import { requireRole, yen } from "@/lib/me";
import { TopBar } from "../nav";

const label = (l: JournalLine) => (l.subAccount ? `${l.account}（${l.subAccount}）` : l.account);

export default async function Accounting() {
  const me = await requireRole("admin", "accounting");
  // 経理担当には確定した給与の仕訳（科目ごとの合計）だけが返る。個人別の金額は含まない
  const { data: entries } = await me.supabase.from("journal_entries").select("id, entry_date, description, lines, exported_at").order("entry_date", { ascending: false });

  return (
    <>
      <TopBar name={me.name} role={me.role} />
      <main>
        <h1>経理：給与仕訳</h1>
        <p className="muted">
          確定した給与ごとに、マネーフォワード クラウド会計の「仕訳帳インポート」で取り込めるCSVを書き出せます。
          勘定科目は仮の標準です（福本先生と科目表を決めたら差し替えます）。
        </p>
        {(entries ?? []).map((e) => {
          const lines = e.lines as { debits: JournalLine[]; credits: JournalLine[] };
          const n = Math.max(lines.debits.length, lines.credits.length);
          const sum = (ls: JournalLine[]) => ls.reduce((a, l) => a + l.amount, 0);
          return (
            <div key={e.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{e.entry_date.replace(/-/g, "/")}　{e.description}</strong>
                <span>
                  {e.exported_at ? <span className="badge">書き出し済み {String(e.exported_at).slice(0, 10).replace(/-/g, "/")}</span> : null}{" "}
                  <a className="button primary" href={`/accounting/${e.id}/csv`}>MF用CSVを書き出す</a>
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>借方</th><th className="num">金額</th><th>貸方</th><th className="num">金額</th></tr></thead>
                  <tbody>
                    {Array.from({ length: n }, (_, i) => (
                      <tr key={i}>
                        <td>{lines.debits[i] ? label(lines.debits[i]) : ""}</td>
                        <td className="num">{lines.debits[i] ? yen(lines.debits[i].amount) : ""}</td>
                        <td>{lines.credits[i] ? label(lines.credits[i]) : ""}</td>
                        <td className="num">{lines.credits[i] ? yen(lines.credits[i].amount) : ""}</td>
                      </tr>
                    ))}
                    <tr><th>合計</th><th className="num">{yen(sum(lines.debits))}</th><th></th><th className="num">{yen(sum(lines.credits))}</th></tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {entries?.length ? null : <p className="muted">確定した給与の仕訳はまだありません。</p>}
      </main>
    </>
  );
}
