import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { encodeCsv, toMoneyForwardCsv, type JournalEntry } from "../src/accounting";

const entry: JournalEntry = {
  date: "2026-10-31",
  description: "10月度 給与支給",
  debits: [
    { account: "給料手当", amount: 300000 },
    { account: "旅費交通費", amount: 10000 },
  ],
  credits: [
    { account: "預り金", subAccount: "社会保険料", amount: 40000 },
    { account: "預り金", subAccount: "源泉所得税", amount: 6000 },
    { account: "普通預金", amount: 264000 },
  ],
};

describe("toMoneyForwardCsv", () => {
  const lines = toMoneyForwardCsv([entry], 101).trimEnd().split("\r\n");

  it("見出しはMFの27列", () => {
    expect(lines[0].split(",")).toHaveLength(27);
    expect(lines[0].startsWith("取引No,取引日,借方勘定科目,借方補助科目")).toBe(true);
  });

  it("複合仕訳は同じ取引No・取引日の行に分け、貸借を横に並べる", () => {
    const rows = lines.slice(1).map((l) => l.split(","));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r[0])).toEqual(["101", "101", "101"]);
    expect(rows[0].slice(1, 4)).toEqual(["2026/10/31", "給料手当", ""]);
    expect(rows[0][8]).toBe("300000");
    expect(rows[0].slice(10, 12)).toEqual(["預り金", "社会保険料"]);
    expect(rows[0][16]).toBe("40000");
    expect(rows[0][18]).toBe("10月度 給与支給");
    expect(rows[2][2]).toBe("");
    expect(rows[2][10]).toBe("普通預金");
    const sum = (col: number) => rows.reduce((s, r) => s + Number(r[col] || 0), 0);
    expect(sum(8)).toBe(sum(16));
  });

  it("Shift_JISで書き出せる", () => {
    const buf = encodeCsv(toMoneyForwardCsv([entry]));
    expect(iconv.decode(buf, "Shift_JIS")).toContain("給料手当");
  });
});
