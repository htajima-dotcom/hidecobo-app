export type PayType = "役員" | "月給" | "時給";
export type HourlyRounding = "四捨五入" | "切り上げ" | "切り捨て";
export type TaxColumn = "甲" | "乙";
export type CommuteMethod = "日数" | "定額" | "なし";

/** 会社共通の計算ルール（Excel「給与計算設定」上段） */
export interface CompanyRules {
  monthlyScheduledHours: number; // 1か月の平均所定労働時間（170）
  overtimeMultiplier: number; // 1.25
  fuelEfficiencyKmPerL: number;
  gasolinePricePerL: number;
  commuteCap: number; // マイカー通勤手当の上限
  hourlyRounding: HourlyRounding;
  sundayMultiplier: number; // 法定休日 1.35
  mileageNonTaxableLimits: { minOneWayKm: number; limit: number }[];
}

/** 月度ごとの料率（Excel「給与計算設定」の月度表） */
export interface MonthSettings {
  payDate: string; // YYYY-MM-DD
  taxTable: string; // "令和8年分" など
  healthRate: number;
  careRate: number;
  childSupportRate: number;
  pensionRate: number;
  employmentRate: number;
  deductSocialInsurance: boolean;
}

/** 従業員ごとの支給・控除の条件 */
export interface EmployeeTerms {
  no: string | null;
  name: string;
  payType: PayType;
  executivePay?: number | null;
  monthlyBase?: number | null;
  hourlyRate?: number | null;
  newHourlyRate?: number | null;
  newHourlyRateFrom?: string | null; // この支給日以降は新時給
  paidLeaveHoursPerDay?: number | null;
  positionAllowance?: number | null;
  adjustmentAllowance?: number | null;
  adjustmentInOvertime?: number | null; // 1なら調整手当を残業単価に含める
  commuteMethod?: CommuteMethod | null;
  commuteRoundTripKm?: number | null;
  commuteFixed?: number | null;
  commuteTaxClass?: string | null; // "非課税" なら全額非課税
  healthStandard?: number | null;
  pensionStandard?: number | null;
  standardRevision?: StandardRevision | null;
  careInsured?: number | null;
  employmentInsured?: number | null;
  taxColumn?: TaxColumn | null;
  dependents?: number | null;
  residentTax?: number | null;
  residentTaxJune?: number | null;
  housing?: number | null;
}

/** 標準報酬月額の改定（随時改定・定時決定） */
export interface StandardRevision {
  healthStandard?: number | null;
  pensionStandard?: number | null;
  fromPayDate: string; // 改定後の額で控除を始める支給日
  settleOnPayDate?: string | null; // 旧額で控除済みの差額を精算する支給日
  settleMonths?: number | null; // 精算する月数
}

/** 勤怠の月集計と、その月だけの手入力 */
export interface MonthlyInput {
  workDays?: number | null;
  scheduledHours?: number | null;
  paidLeaveDays?: number | null;
  overtimeHours?: number | null;
  commuteDays?: number | null;
  sundayHours?: number | null;
  otherTaxable?: number | null;
  adjustmentOverride?: number | null; // 調整手当（遡及等）をその月だけ手入力
  commuteAdjustment?: number | null;
  incomeTaxManual?: number | null;
  otherDeduction?: number | null;
}

export interface TaxTable {
  taxFreeBelow: number;
  rows: { min: number; max: number; kou: number[]; otsu: number | string }[];
  high: { min: number; rate: number; kou: number[] }[];
  otsuHigh: { min: number; base: number; rate: number }[];
}

export interface PayrollResult {
  hourlyRate: number | null;
  executivePay: number;
  basePay: number;
  paidLeavePay: number;
  positionAllowance: number;
  adjustmentAllowance: number;
  overtimeRate: number;
  overtimePay: number;
  commutePay: number;
  commuteNonTaxable: number;
  commuteTaxable: number;
  taxableTotal: number;
  nonTaxableTotal: number;
  grossPay: number;
  healthInsurance: number;
  careInsurance: number;
  childSupport: number;
  pension: number;
  employmentInsurance: number;
  socialInsuranceTotal: number;
  afterSocialInsurance: number;
  incomeTaxTable: number;
  incomeTax: number;
  residentTax: number;
  housing: number;
  deductionTotal: number;
  netPay: number;
  salarySubtotal: number;
  sundayRate: number;
  sundayPay: number;
}
