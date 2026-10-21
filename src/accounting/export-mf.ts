// 仕訳をマネーフォワード クラウド会計の「仕訳帳インポート」CSVにする。
// 仕様: https://biz.moneyforward.com/support/account/guide/import-books/ib01.html
// 税区分は空欄にし、MF側の勘定科目のデフォルト税区分で取り込む（給与・預り金は対象外、通勤手当は課税仕入）。

import iconv from "iconv-lite";
import type { JournalEntry, JournalLine } from "./payroll-journal";

const HEADER = [
  "取引No", "取引日",
  "借方勘定科目", "借方補助科目", "借方部門", "借方取引先", "借方税区分", "借方インボイス", "借方金額(円)", "借方税額",
  "貸方勘定科目", "貸方補助科目", "貸方部門", "貸方取引先", "貸方税区分", "貸方インボイス", "貸方金額(円)", "貸方税額",
  "摘要", "仕訳メモ", "タグ", "MF仕訳タイプ", "決算整理仕訳", "作成日時", "作成者", "最終更新日時", "最終更新者",
];

const cell = (v: string | number | undefined): string => {
  const s = v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const side = (l: JournalLine | undefined): (string | number | undefined)[] =>
  l ? [l.account, l.subAccount, undefined, undefined, undefined, undefined, l.amount, undefined] : Array(8).fill(undefined);

/** 1仕訳＝同じ取引Noの複数行（複合仕訳）。取引Noは startNo から順に振る */
export function toMoneyForwardCsv(entries: JournalEntry[], startNo = 1): string {
  const rows: string[] = [HEADER.join(",")];
  entries.forEach((e, i) => {
    const no = startNo + i;
    const date = e.date.replace(/-/g, "/");
    const n = Math.max(e.debits.length, e.credits.length);
    for (let k = 0; k < n; k++) {
      const values = [no, date, ...side(e.debits[k]), ...side(e.credits[k]), k === 0 ? e.description : undefined];
      while (values.length < HEADER.length) values.push(undefined);
      rows.push(values.map(cell).join(","));
    }
  });
  return rows.join("\r\n") + "\r\n";
}

/** MFへ取り込むファイルの中身（既定は Shift_JIS。取り込めない場合は "utf8" を試す） */
export function encodeCsv(csv: string, encoding: "shift_jis" | "utf8" = "shift_jis"): Buffer {
  return encoding === "utf8" ? Buffer.from("﻿" + csv, "utf8") : iconv.encode(csv, "Shift_JIS");
}
