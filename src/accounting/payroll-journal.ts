// 確定した給与から給与仕訳（複合仕訳）を作る。
// 勘定科目は仮の標準。福本先生と科目表を決めたら AccountMap を差し替える。

import type { PayrollResult, PayType } from "../payroll";

export interface JournalLine {
  account: string;
  subAccount?: string;
  amount: number;
  memo?: string;
}

export interface JournalEntry {
  date: string; // YYYY-MM-DD
  description: string;
  debits: JournalLine[];
  credits: JournalLine[];
}

export interface AccountMap {
  executivePay: string; // 役員の支給
  salary: Record<string, string>; // 契約種別ごとの支給（正社員・パートなど）
  defaultSalary: string;
  commute: string; // 通勤手当
  socialInsurance: JournalAccount; // 健保・介護・子育て支援金・厚年の本人負担
  employmentInsurance: JournalAccount;
  incomeTax: JournalAccount;
  residentTax: JournalAccount;
  housing: JournalAccount; // 社宅費の控除
  otherDeduction: JournalAccount;
  payment: JournalAccount; // 差引支給額の支払い
}

export interface JournalAccount {
  account: string;
  subAccount?: string;
}

/** 仮の標準科目（中小企業で一般的な科目名） */
export const DEFAULT_ACCOUNTS: AccountMap = {
  executivePay: "役員報酬",
  salary: { 正社員: "給料手当", パート: "雑給" },
  defaultSalary: "給料手当",
  commute: "旅費交通費",
  socialInsurance: { account: "預り金", subAccount: "社会保険料" },
  employmentInsurance: { account: "預り金", subAccount: "雇用保険料" },
  incomeTax: { account: "預り金", subAccount: "源泉所得税" },
  residentTax: { account: "預り金", subAccount: "住民税" },
  housing: { account: "地代家賃", subAccount: "社宅家賃" },
  otherDeduction: { account: "預り金", subAccount: "その他" },
  payment: { account: "普通預金" },
};

export interface PayslipForJournal {
  payType: PayType;
  contract?: string | null;
  result: PayrollResult;
  otherDeduction?: number | null;
}

function addLine(lines: JournalLine[], acc: JournalAccount | string, amount: number): void {
  if (!amount) return;
  const a = typeof acc === "string" ? { account: acc } : acc;
  const hit = lines.find((l) => l.account === a.account && l.subAccount === a.subAccount);
  if (hit) hit.amount += amount;
  else lines.push({ ...a, amount });
}

/** 1回の給与支給分を、科目ごとに合計した1本の複合仕訳にする（個人別の金額は仕訳に残さない） */
export function buildPayrollJournal(
  payDate: string,
  label: string,
  slips: PayslipForJournal[],
  accounts: AccountMap = DEFAULT_ACCOUNTS,
): JournalEntry {
  const debits: JournalLine[] = [];
  const credits: JournalLine[] = [];

  for (const { payType, contract, result: r, otherDeduction } of slips) {
    // 支給：通勤手当は旅費交通費、それ以外は役員報酬か契約種別ごとの給与科目
    const pay = r.grossPay - r.commutePay;
    const salaryAccount =
      payType === "役員" ? accounts.executivePay : (contract && accounts.salary[contract]) || accounts.defaultSalary;
    addLine(debits, salaryAccount, pay);
    addLine(debits, accounts.commute, r.commutePay);

    // 控除と差引支給額
    addLine(credits, accounts.socialInsurance, r.healthInsurance + r.careInsurance + r.childSupport + r.pension);
    addLine(credits, accounts.employmentInsurance, r.employmentInsurance);
    addLine(credits, accounts.incomeTax, r.incomeTax);
    addLine(credits, accounts.residentTax, r.residentTax);
    addLine(credits, accounts.housing, r.housing);
    addLine(credits, accounts.otherDeduction, typeof otherDeduction === "number" ? otherDeduction : 0);
    addLine(credits, accounts.payment, r.netPay);
  }

  const entry = { date: payDate, description: `${label} 給与支給`, debits, credits };
  const sum = (ls: JournalLine[]) => ls.reduce((s, l) => s + l.amount, 0);
  if (sum(debits) !== sum(credits)) {
    throw new Error(`給与仕訳の貸借が一致しません（借方 ${sum(debits)} / 貸方 ${sum(credits)}）`);
  }
  return entry;
}
