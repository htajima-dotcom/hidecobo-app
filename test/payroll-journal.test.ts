// 既存Excelの各月の給与から作った給与仕訳が、貸借一致し、支給・控除の合計と合うことを確かめる。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPayrollJournal } from "../src/accounting";
import { calculatePayroll, type TaxTable } from "../src/payroll";

const dir = join(__dirname, "..", "fixtures");
const files = readdirSync(dir).filter((f) => f.startsWith("payroll-"));
const taxTables: Record<string, TaxTable> = files.length
  ? JSON.parse(readFileSync(join(dir, "tax-tables.json"), "utf8"))
  : {};

describe.each(files)("%s", (file) => {
  const fx = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const slips = fx.cases.map((c: any) => ({
    payType: c.employee.payType,
    contract: c.employee.contract,
    otherDeduction: c.input.otherDeduction,
    result: calculatePayroll(c.employee, c.input, fx.rules, fx.monthSettings, taxTables[fx.monthSettings.taxTable]),
  }));

  it("貸借が一致し、借方合計＝支給合計、普通預金＝差引支給額の合計", () => {
    const entry = buildPayrollJournal(fx.monthSettings.payDate, fx.month, slips);
    const total = (k: string) => slips.reduce((s: number, x: any) => s + x.result[k], 0);
    const debit = entry.debits.reduce((s, l) => s + l.amount, 0);
    expect(debit).toBe(total("grossPay"));
    expect(entry.credits.find((l) => l.account === "普通預金")?.amount).toBe(total("netPay"));
    expect(entry.credits.find((l) => l.subAccount === "源泉所得税")?.amount).toBe(total("incomeTax"));
    expect(entry.debits.find((l) => l.account === "旅費交通費")?.amount ?? 0).toBe(total("commutePay"));
  });
});

describe("buildPayrollJournal", () => {
  it("役員は役員報酬、パートは雑給に分ける", () => {
    const zero = Object.fromEntries(
      ["grossPay", "commutePay", "healthInsurance", "careInsurance", "childSupport", "pension",
        "employmentInsurance", "incomeTax", "residentTax", "housing", "netPay"].map((k) => [k, 0]),
    ) as any;
    const entry = buildPayrollJournal("2026-10-31", "10月度", [
      { payType: "役員", result: { ...zero, grossPay: 500000, incomeTax: 20000, netPay: 480000 } },
      { payType: "時給", contract: "パート", result: { ...zero, grossPay: 105000, commutePay: 5000, netPay: 105000 } },
    ]);
    expect(entry.debits).toEqual([
      { account: "役員報酬", amount: 500000 },
      { account: "雑給", amount: 100000 },
      { account: "旅費交通費", amount: 5000 },
    ]);
    expect(entry.credits).toEqual([
      { account: "預り金", subAccount: "源泉所得税", amount: 20000 },
      { account: "普通預金", amount: 585000 },
    ]);
  });
});
