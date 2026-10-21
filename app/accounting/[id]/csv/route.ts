import { NextResponse, type NextRequest } from "next/server";
import { encodeCsv, toMoneyForwardCsv, type JournalLine } from "@/src/accounting";
import { createClient } from "@/lib/supabase/server";

/** 給与仕訳1件を、MF仕訳帳インポート用CSV（Shift_JIS）でダウンロードさせる */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // 見られるかどうかはデータベースの権限（権限者・経理担当の確定分のみ）で決まる
  const { data: e } = await supabase.from("journal_entries").select("entry_date, description, lines").eq("id", id).maybeSingle();
  if (!e) return new NextResponse("見つからないか、権限がありません", { status: 404 });
  const lines = e.lines as { debits: JournalLine[]; credits: JournalLine[] };
  const csv = toMoneyForwardCsv([{ date: e.entry_date, description: e.description, ...lines }]);
  const utf8 = req.nextUrl.searchParams.get("enc") === "utf8";
  await supabase.rpc("mark_journal_exported", { entry: id });
  const filename = `給与仕訳_${e.entry_date}.csv`;
  return new NextResponse(new Uint8Array(encodeCsv(csv, utf8 ? "utf8" : "shift_jis")), {
    headers: {
      "Content-Type": `text/csv; charset=${utf8 ? "utf-8" : "shift_jis"}`,
      "Content-Disposition": `attachment; filename="payroll-journal-${e.entry_date}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
