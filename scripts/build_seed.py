"""既存Excelから取り出した fixtures から、Supabase の SQL Editor に貼る初期データの SQL を作る。

  python3 -I scripts/build_seed.py fixtures 2026-10-21 > seed.sql

従業員・労働条件（月ごとに変わった分だけ）・会社のルール・月度の料率・源泉税額表、
指定日までの勤怠を入れる。実データを含むため、出力はリポジトリに入れないこと。
"""
import glob
import json
import os
import sys

src, until = sys.argv[1], sys.argv[2]


def j(v):
    s = json.dumps(v, ensure_ascii=False, sort_keys=True)
    assert "$j$" not in s
    return f"$j${s}$j$::jsonb"


def q(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


payroll = sorted(glob.glob(os.path.join(src, "payroll-*.json")))
attendance = sorted(glob.glob(os.path.join(src, "attendance-*.json")))
out = ["-- ヒデ工房 初期データ（既存Excelから作成）。何度実行しても重複しない", "begin;"]

# 勤怠ルール（計算開始時刻・休憩なし）は勤怠シートの名字で対応づける
att_rules = {}
for path in attendance:
    for p in json.load(open(path, encoding="utf-8"))["people"]:
        att_rules[p["name"]] = p.get("rules") or {}

employees, last_terms, last_rules = {}, {}, None
for path in payroll:
    d = json.load(open(path, encoding="utf-8"))
    pay = d["monthSettings"]["payDate"]
    if d["rules"] != last_rules:
        out.append(f"insert into company_rules (effective_from, rules) values ('{pay}', {j(d['rules'])}) on conflict do nothing;")
        last_rules = d["rules"]
    label = f"{int(pay[5:7])}月度"
    out.append(f"insert into rate_settings (pay_date, label, settings, status) values ('{pay}', '{label}', {j(d['monthSettings'])}, 'approved') on conflict do nothing;")
    for c in d["cases"]:
        e = c["employee"]
        terms = {k: v for k, v in e.items() if k not in ("row", "attendanceName", "contract")}
        if e["no"] not in employees:
            employees[e["no"]] = e
            rules = att_rules.get(e.get("attendanceName") or "", {})
            out.append(
                "insert into employees (employee_no, name, contract, pay_type, attendance_rules) values "
                f"({q(e['no'])}, {q(e['name'])}, {q(e['contract'])}, {q(e['payType'])}, {j(rules)}) on conflict (employee_no) do nothing;"
            )
        if last_terms.get(e["no"]) != terms:
            out.append(
                "insert into employment_terms (employee_id, effective_from, terms, note) "
                f"select id, '{pay}', {j(terms)}, '既存Excel {os.path.basename(path)}' from employees where employee_no = {q(e['no'])} on conflict do nothing;"
            )
            last_terms[e["no"]] = terms

for name, table in json.load(open(os.path.join(src, "tax-tables.json"), encoding="utf-8")).items():
    out.append(f"insert into tax_tables (name, table_data) values ({q(name)}, {j(table)}) on conflict do nothing;")

# 勤怠は指定日まで、区分か時刻が入っている日だけ
by_name = {e.get("attendanceName"): no for no, e in employees.items() if e.get("attendanceName")}
for path in attendance:
    for p in json.load(open(path, encoding="utf-8"))["people"]:
        no = by_name.get(p["name"])
        if not no:
            continue
        for day in p["days"]:
            if day["date"] > until or not (day["status"] or day.get("in") or day.get("out")):
                continue
            out.append(
                "insert into attendance_days (employee_id, work_date, status, clock_in, clock_out, break_minutes) "
                f"select id, '{day['date']}', {q(day['status'])}, {q(day.get('in'))}, {q(day.get('out'))}, {q(day.get('breakMinutes'))} "
                f"from employees where employee_no = {q(no)} on conflict do nothing;"
            )

# ログイン済みの権限者・スタッフと、従業員の記録を名前で結びつける
out.append("update employees e set user_id = m.user_id from members m where e.user_id is null and replace(m.display_name, '　', ' ') = e.name;")
out.append("commit;")
print("\n".join(out))
