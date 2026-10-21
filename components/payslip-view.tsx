import type { MonthlyInput, PayrollResult } from "@/src/payroll";
import { yen } from "@/lib/me";

const PAY: [keyof PayrollResult, string][] = [
  ["executivePay", "役員報酬"],
  ["basePay", "基本給"],
  ["positionAllowance", "役職手当"],
  ["adjustmentAllowance", "調整手当"],
  ["overtimePay", "残業手当"],
  ["sundayPay", "休日出勤手当"],
  ["commutePay", "通勤手当"],
];
const DEDUCT: [keyof PayrollResult, string][] = [
  ["healthInsurance", "健康保険"],
  ["careInsurance", "介護保険"],
  ["childSupport", "子ども・子育て支援金"],
  ["pension", "厚生年金"],
  ["employmentInsurance", "雇用保険"],
  ["incomeTax", "所得税"],
  ["residentTax", "住民税"],
  ["housing", "社宅費"],
];

function Rows({ items, r }: { items: [keyof PayrollResult, string][]; r: PayrollResult }) {
  return (
    <>
      {items
        .filter(([k]) => Number(r[k] ?? 0) !== 0)
        .map(([k, label]) => (
          <tr key={k}><td>{label}</td><td className="num">{yen(r[k] as number)}</td></tr>
        ))}
    </>
  );
}

/** 給与明細1枚分（本人用・権限者用で共通） */
export function PayslipView({ input, result: r }: { input: MonthlyInput; result: PayrollResult }) {
  const other = Number(input.otherDeduction ?? 0);
  return (
    <>
      <div className="card">
        出勤 {input.workDays ?? 0}日　所定 {input.scheduledHours ?? 0}時間　有休 {input.paidLeaveDays ?? 0}日　残業 {input.overtimeHours ?? 0}時間　日曜 {input.sundayHours ?? 0}時間
      </div>
      <div className="grid2">
        <div className="card table-wrap">
          <table>
            <thead><tr><th>支給</th><th></th></tr></thead>
            <tbody>
              <Rows items={PAY} r={r} />
              {r.paidLeavePay ? <tr><td className="muted">（基本給のうち有休分）</td><td className="num muted">{yen(r.paidLeavePay)}</td></tr> : null}
              {Number(input.otherTaxable ?? 0) ? <tr><td>その他支給</td><td className="num">{yen(Number(input.otherTaxable))}</td></tr> : null}
              <tr><th>総支給額</th><th className="num">{yen(r.grossPay)}</th></tr>
            </tbody>
          </table>
        </div>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>控除</th><th></th></tr></thead>
            <tbody>
              <Rows items={DEDUCT} r={r} />
              {other ? <tr><td>その他控除</td><td className="num">{yen(other)}</td></tr> : null}
              <tr><th>控除合計</th><th className="num">{yen(r.deductionTotal)}</th></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card"><strong>差引支給額 {yen(r.netPay)}</strong></div>
    </>
  );
}
