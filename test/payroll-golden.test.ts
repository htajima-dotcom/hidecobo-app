// 既存Excel（社労士準拠版）の計算結果と、1円単位で一致することを確かめる。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculatePayroll, type TaxTable } from "../src/payroll";

const dir = join(__dirname, "..", "fixtures");
// 実データの fixtures が無い環境（CIなど）ではスキップする
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("payroll-")) : [];

const taxTables: Record<string, TaxTable> = files.length
  ? JSON.parse(readFileSync(join(dir, "tax-tables.json"), "utf8"))
  : {};

describe.each(files)("%s", (file) => {
  const fx = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const cases: { employee: any; input: any; expected: Record<string, number | null> }[] = fx.cases;
  it.each(cases.map((c) => ({ name: c.employee.name as string, c })))("$name", ({ c }) => {
    const result = calculatePayroll(c.employee, c.input, fx.rules, fx.monthSettings, taxTables[fx.monthSettings.taxTable]);
    const expected = Object.fromEntries(
      Object.entries(c.expected).map(([k, v]) => [k, v === null && k !== "hourlyRate" ? 0 : v]),
    );
    const actual = Object.fromEntries(Object.keys(expected).map((k) => [k, (result as any)[k]]));
    expect(actual).toEqual(expected);
  });
});
