// 指定した月度の給与仕訳を、MF取込用CSV（Shift_JIS）に書き出す。
// 使い方: npx tsx scripts/export-payroll-journal.ts fixtures/payroll-2026-10.json out.csv [utf8]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildPayrollJournal, encodeCsv, toMoneyForwardCsv } from "../src/accounting";
import { calculatePayroll } from "../src/payroll";

const [input, output, enc] = process.argv.slice(2);
const fx = JSON.parse(readFileSync(input, "utf8"));
const tax = JSON.parse(readFileSync(join(dirname(input), "tax-tables.json"), "utf8"))[fx.monthSettings.taxTable];
const slips = fx.cases.map((c: any) => ({
  payType: c.employee.payType,
  contract: c.employee.contract,
  otherDeduction: c.input.otherDeduction,
  result: calculatePayroll(c.employee, c.input, fx.rules, fx.monthSettings, tax),
}));
const entry = buildPayrollJournal(fx.monthSettings.payDate, fx.month, slips);
writeFileSync(output, encodeCsv(toMoneyForwardCsv([entry]), enc === "utf8" ? "utf8" : "shift_jis"));
console.log(`${output} に書き出しました（借方 ${entry.debits.length} 行 / 貸方 ${entry.credits.length} 行）`);
