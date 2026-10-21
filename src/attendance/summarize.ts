// 日ごとの勤怠（区分・出退勤時刻）から、給与計算に渡す月の集計を作る。
// Excel「X月度 (M.26-M.25)」シートの式を移したもの。

export type DayStatus =
  | "出勤"
  | "休日出勤"
  | "午前休"
  | "午後休"
  | "午前有給"
  | "午後有給"
  | "公休"
  | "有休"
  | "休み"
  | "病欠"
  | "私用"
  | "災害"
  | "不明な休み(要確認)"
  | "欠勤"
  | "";

export interface DayRecord {
  date: string; // YYYY-MM-DD
  status: DayStatus | string;
  in?: string | null; // HH:MM（丸めない実際の時刻）
  out?: string | null;
  breakMinutes?: number | null; // その日だけ休憩時間を手で指定する場合
}

/** 従業員ごとの勤怠ルール */
export interface AttendanceRules {
  calcStart?: string | null; // 計算開始時刻。これより前に出勤しても、この時刻から数える
  noBreak?: boolean; // 休憩の自動判定を使わない（休憩なしの勤務）
}

export interface AttendanceSummary {
  workDays: number;
  scheduledHours: number;
  paidLeaveDays: number;
  holidays: number;
  overtimeHours: number; // 日曜を除く残業・休出（30分単位で四捨五入した時間）
  commuteDays: number;
  sundayHours: number; // 法定休日（日曜）の労働時間（同上）
}

const NOT_WORKED = new Set(["", "公休", "有休", "休み", "病欠", "私用", "災害", "不明な休み(要確認)", "欠勤"]);
const DAILY_SCHEDULED_MIN = 8 * 60;

const minutes = (t: string): number => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 60 + m + (s ?? 0) / 60;
};

/** 0=日曜 … 6=土曜（日付文字列はローカル時差の影響を受けないよう UTC で扱う） */
const weekday = (d: string): number => new Date(`${d}T00:00:00Z`).getUTCDay();

const addDays = (d: string, days: number): string =>
  new Date(Date.parse(`${d}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

/** 月の合計分数を、30分以上は切り上げ・30分未満は切り捨てで時間にする */
const toRoundedHours = (totalMinutes: number): number => {
  const m = Math.round(totalMinutes);
  return m % 60 >= 30 ? Math.floor(m / 60) + 1 : Math.floor(m / 60);
};

const count = (days: DayRecord[], ...statuses: string[]): number =>
  days.filter((d) => statuses.includes(d.status)).length;

export function summarizeAttendance(days: DayRecord[], rules: AttendanceRules = {}): AttendanceSummary {
  let scheduledMin = 0;
  let overtimeMin = 0;
  let sundayMin = 0;

  days.forEach((day, i) => {
    if (NOT_WORKED.has(day.status) || !day.in || !day.out) return;
    const actualIn = minutes(day.in);
    const end = minutes(day.out);
    // 12時以前に出勤し13時以降に退勤した日は休憩1時間（実際の出勤時刻で判定）
    const rest =
      typeof day.breakMinutes === "number"
        ? day.breakMinutes
        : !rules.noBreak && actualIn <= 12 * 60 && end >= 13 * 60
          ? 60
          : 0;
    const start = rules.calcStart ? Math.max(actualIn, minutes(rules.calcStart)) : actualIn;
    const worked = Math.max(0, end - start - rest);

    // その週（月曜始まり、月度の初日より前は数えない）で出勤時刻のある6日目以降は休日出勤扱い
    const monday = addDays(day.date, -((weekday(day.date) + 6) % 7));
    const daysThisWeek = days.slice(0, i + 1).filter((d) => d.date >= monday && !!d.in).length;

    const isSunday = weekday(day.date) === 0;
    if (isSunday || day.status === "休日出勤" || daysThisWeek >= 6) {
      if (isSunday) sundayMin += worked;
      else overtimeMin += worked;
    } else {
      scheduledMin += Math.min(worked, DAILY_SCHEDULED_MIN);
      overtimeMin += Math.max(0, worked - DAILY_SCHEDULED_MIN);
    }
  });

  const halfDays = count(days, "午前休", "午後休", "午前有給", "午後有給");
  return {
    workDays: count(days, "出勤", "休日出勤") + halfDays * 0.5,
    scheduledHours: Math.round((scheduledMin / 60) * 100) / 100,
    paidLeaveDays: count(days, "有休") + count(days, "午前有給", "午後有給") * 0.5,
    holidays: count(days, "公休"),
    overtimeHours: toRoundedHours(overtimeMin),
    commuteDays: count(days, "出勤", "休日出勤") + halfDays,
    sundayHours: toRoundedHours(sundayMin),
  };
}
