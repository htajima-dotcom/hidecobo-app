import { roundDown } from "./excel-round";
import type { TaxColumn, TaxTable } from "./types";

/** 区間表から「min以下で最大の行」を探す（ExcelのMATCH(...,1)と同じ） */
function lookup<T extends { min: number }>(rows: T[], amount: number): T {
  let hit = rows[0];
  for (const r of rows) {
    if (r.min <= amount) hit = r;
    else break;
  }
  return hit;
}

/**
 * 源泉徴収税額表（月額表）による所得税。
 * amount は社会保険料等控除後の給与等の金額。
 */
export function withholdingTax(
  table: TaxTable,
  amount: number,
  column: TaxColumn | null | undefined,
  dependents: number,
): number {
  if (column === "甲") {
    if (amount < table.taxFreeBelow) return 0;
    const idx = Math.min(dependents, 7);
    let tax: number;
    if (amount < 740000) {
      tax = lookup(table.rows, amount).kou[idx];
    } else {
      const h = lookup(table.high, amount);
      tax = h.kou[idx] + roundDown((amount - h.min) * h.rate);
    }
    // 扶養8人以上は1人につき1,610円を差し引く
    return Math.max(0, tax - 1610 * Math.max(0, dependents - 7));
  }
  if (column === "乙") {
    if (amount < table.taxFreeBelow) return roundDown(amount * 0.03063);
    if (amount < 740000) return Number(lookup(table.rows, amount).otsu);
    const h = lookup(table.otsuHigh, amount);
    return h.base + roundDown((amount - h.min) * h.rate);
  }
  return 0;
}
