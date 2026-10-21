// 日ごとの勤怠から作る月集計が、既存Excelの集計と一致することを確かめる。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeAttendance, type AttendanceRules, type DayRecord } from "../src/attendance";

const dir = join(__dirname, "..", "fixtures");
const files = readdirSync(dir).filter((f) => f.startsWith("attendance-"));

describe.each(files)("%s", (file) => {
  const fx = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const people: { name: string; rules: AttendanceRules; days: DayRecord[]; expected: Record<string, number> }[] =
    fx.people;
  it.each(people)("$name", ({ rules, days, expected }) => {
    expect(summarizeAttendance(days, rules)).toEqual(expected);
  });
});
