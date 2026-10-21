import { round, roundDown, roundUp } from "./excel-round";
import { withholdingTax } from "./withholding";
import type {
  CompanyRules,
  EmployeeTerms,
  MonthlyInput,
  MonthSettings,
  PayrollResult,
  TaxTable,
} from "./types";

const n = (v: number | null | undefined): number => (typeof v === "number" ? v : 0);

/** 社会保険料の本人負担：50銭以下切り捨て、50銭超切り上げ */
const halfShare = (standard: number, rate: number): number =>
  Math.max(0, roundUp(round((standard * rate) / 2, 2) - 0.5));

/**
 * 1人・1か月分の給与を計算する。
 * Excel「給与計算_X月度」シートの各列の式を、そのままの順番で移したもの。
 */
export function calculatePayroll(
  emp: EmployeeTerms,
  input: MonthlyInput,
  rules: CompanyRules,
  month: MonthSettings,
  taxTable: TaxTable,
): PayrollResult {
  const isExec = emp.payType === "役員";
  const isMonthly = emp.payType === "月給";
  const isHourly = emp.payType === "時給";

  // 適用時給：改定後の時給は、適用開始の支給日以降に切り替える
  let hourlyRate: number | null = null;
  if (isHourly) {
    const switched =
      n(emp.newHourlyRate) > 0 && !!emp.newHourlyRateFrom && month.payDate >= emp.newHourlyRateFrom;
    hourlyRate = switched ? n(emp.newHourlyRate) : n(emp.hourlyRate);
  }
  const rate = n(hourlyRate);

  const executivePay = isExec ? n(emp.executivePay) : 0;

  // 時給者の基本給 =（所定時間＋有休日数×有休1日の時間）× 時給
  let basePay = 0;
  if (isMonthly) {
    basePay = n(emp.monthlyBase);
  } else if (isHourly) {
    const hours = round(n(input.scheduledHours) + n(input.paidLeaveDays) * n(emp.paidLeaveHoursPerDay), 2);
    if (rules.hourlyRounding === "切り上げ") basePay = roundUp(hours * rate);
    else if (rules.hourlyRounding === "四捨五入") basePay = round(hours * rate);
    else basePay = roundDown(hours * rate + 0.0000001);
  }
  const paidLeavePay = isHourly ? round(n(input.paidLeaveDays) * n(emp.paidLeaveHoursPerDay) * rate) : 0;

  const positionAllowance = isExec ? 0 : n(emp.positionAllowance);
  const adjustmentAllowance =
    typeof input.adjustmentOverride === "number" ? input.adjustmentOverride : isExec ? 0 : n(emp.adjustmentAllowance);

  // 月給者の時間単価の基礎 = 基本給＋役付手当（＋調整手当を含める設定なら調整手当）
  const monthlyBasis =
    n(emp.monthlyBase) + n(emp.positionAllowance) + (n(emp.adjustmentInOvertime) === 1 ? n(emp.adjustmentAllowance) : 0);
  const unitRate = (multiplier: number): number => {
    if (isMonthly) return round((monthlyBasis / rules.monthlyScheduledHours) * multiplier);
    if (isHourly) return round(rate * multiplier);
    return 0;
  };

  // 時間外手当：月60時間までは1.25倍、超えた分は1.5倍
  const overtimeRate = unitRate(rules.overtimeMultiplier);
  const ot = n(input.overtimeHours);
  const overtimePay =
    ot <= 60 ? round(overtimeRate * ot) : round(overtimeRate * 60 + unitRate(1.5) * (ot - 60));

  // 法定休日（日曜）の労働：1.35倍
  const sundayRate = unitRate(rules.sundayMultiplier);
  const sundayPay = round(sundayRate * n(input.sundayHours));

  // 通勤手当
  let commutePay = 0;
  if (emp.commuteMethod === "日数") {
    commutePay = Math.min(
      rules.commuteCap,
      roundDown(
        ((n(input.commuteDays) * n(emp.commuteRoundTripKm)) / rules.fuelEfficiencyKmPerL) * rules.gasolinePricePerL,
      ),
    );
  } else if (emp.commuteMethod === "定額") {
    commutePay = n(emp.commuteFixed);
  }
  commutePay += n(input.commuteAdjustment);

  let commuteNonTaxable: number;
  if (emp.commuteTaxClass === "非課税") {
    commuteNonTaxable = commutePay;
  } else if (emp.commuteMethod === "日数") {
    const oneWay = n(emp.commuteRoundTripKm) / 2;
    let limit = rules.mileageNonTaxableLimits[0]?.limit ?? 0;
    for (const l of rules.mileageNonTaxableLimits) if (l.minOneWayKm <= oneWay) limit = l.limit;
    commuteNonTaxable = Math.min(commutePay, limit);
  } else {
    commuteNonTaxable = Math.min(commutePay, 150000);
  }
  const commuteTaxable = commutePay - commuteNonTaxable;

  const otherTaxable = n(input.otherTaxable);
  const taxableTotal =
    executivePay + basePay + positionAllowance + adjustmentAllowance + overtimePay + otherTaxable + commuteTaxable + sundayPay;
  const nonTaxableTotal = commuteNonTaxable;
  const grossPay = taxableTotal + nonTaxableTotal;

  // 社会保険料（標準報酬月額×料率÷2）
  const deduct = month.deductSocialInsurance;
  // 標準報酬の改定：適用開始の支給日から新しい額。精算する支給日には旧額との差額×月数を上乗せ
  const rev = emp.standardRevision;
  const oldHs = n(emp.healthStandard);
  const oldPs = n(emp.pensionStandard);
  const revActive = !!rev?.fromPayDate && month.payDate >= rev.fromPayDate;
  const hs = revActive && n(rev?.healthStandard) > 0 ? n(rev?.healthStandard) : oldHs;
  const ps = revActive && n(rev?.pensionStandard) > 0 ? n(rev?.pensionStandard) : oldPs;
  const settle =
    rev && n(rev.healthStandard) + n(rev.pensionStandard) > 0 && rev.settleOnPayDate === month.payDate
      ? n(rev.settleMonths)
      : 0;
  const withSettlement = (calc: (std: number) => number, current: number, old: number): number =>
    calc(current) + (calc(current) - calc(old)) * settle;

  const healthInsurance = deduct && hs > 0 ? withSettlement((s) => halfShare(s, month.healthRate), hs, oldHs) : 0;
  const careInsurance =
    deduct && hs > 0 && n(emp.careInsured) === 1 ? withSettlement((s) => halfShare(s, month.careRate), hs, oldHs) : 0;
  const childSupport =
    deduct && hs > 0 ? withSettlement((s) => round((s * month.childSupportRate) / 2), hs, oldHs) : 0;
  const pension = deduct && ps > 0 ? withSettlement((s) => halfShare(s, month.pensionRate), ps, oldPs) : 0;
  const employmentInsurance =
    n(emp.employmentInsured) === 1 ? Math.max(0, roundUp(round(grossPay * month.employmentRate, 2) - 0.5)) : 0;
  const socialInsuranceTotal = healthInsurance + careInsurance + childSupport + pension + employmentInsurance;
  const afterSocialInsurance = Math.max(0, taxableTotal - socialInsuranceTotal);

  const incomeTaxTable = withholdingTax(taxTable, afterSocialInsurance, emp.taxColumn, n(emp.dependents));
  const incomeTax = typeof input.incomeTaxManual === "number" ? input.incomeTaxManual : incomeTaxTable;

  // 住民税：6月分だけ額が違う（6月分の額が設定されている場合）
  const isJune = month.payDate.slice(5, 7) === "06";
  const residentTax = isJune && typeof emp.residentTaxJune === "number" ? emp.residentTaxJune : n(emp.residentTax);
  const housing = n(emp.housing);

  const deductionTotal = socialInsuranceTotal + incomeTax + residentTax + housing + n(input.otherDeduction);
  const netPay = grossPay - deductionTotal;
  const salarySubtotal = basePay + positionAllowance + adjustmentAllowance + overtimePay + otherTaxable + sundayPay;

  return {
    hourlyRate,
    executivePay,
    basePay,
    paidLeavePay,
    positionAllowance,
    adjustmentAllowance,
    overtimeRate,
    overtimePay,
    commutePay,
    commuteNonTaxable,
    commuteTaxable,
    taxableTotal,
    nonTaxableTotal,
    grossPay,
    healthInsurance,
    careInsurance,
    childSupport,
    pension,
    employmentInsurance,
    socialInsuranceTotal,
    afterSocialInsurance,
    incomeTaxTable,
    incomeTax,
    residentTax,
    housing,
    deductionTotal,
    netPay,
    salarySubtotal,
    sundayRate,
    sundayPay,
  };
}
