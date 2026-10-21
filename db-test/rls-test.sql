-- 権限（RLS）のテスト。失敗すると例外で止まる。
\set ON_ERROR_STOP on
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 利用者：権限者・経理担当・スタッフ2名
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into auth.users values ('00000000-0000-0000-0000-00000000000c');
insert into members (user_id, role, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', '社長'),
  ('00000000-0000-0000-0000-00000000000c', 'admin', '社労士'),
  ('00000000-0000-0000-0000-00000000000b', 'accounting', '経理'),
  ('00000000-0000-0000-0000-000000000001', 'staff', 'スタッフ1'),
  ('00000000-0000-0000-0000-000000000002', 'staff', 'スタッフ2');
insert into employees (id, name, user_id, contract, pay_type) values
  ('10000000-0000-0000-0000-00000000000b', '経理', '00000000-0000-0000-0000-00000000000b', 'パート', '時給'),
  ('10000000-0000-0000-0000-000000000001', 'スタッフ1', '00000000-0000-0000-0000-000000000001', '正社員', '月給'),
  ('10000000-0000-0000-0000-000000000002', 'スタッフ2', '00000000-0000-0000-0000-000000000002', 'パート', '時給');
insert into employment_terms (employee_id, effective_from, terms)
  select id, '2026-09-30', '{"monthlyBase": 250000}' from employees;
insert into attendance_days (employee_id, work_date, status, clock_in, clock_out)
  select id, '2026-10-01', '出勤', '08:30', '17:30' from employees;
insert into payroll_runs (id, pay_date, label, status) values
  ('20000000-0000-0000-0000-000000000001', '2026-10-31', '10月度', 'confirmed'),
  ('20000000-0000-0000-0000-000000000002', '2026-11-30', '11月度', 'draft');
insert into payslips (run_id, employee_id, input, result)
  select r.id, e.id, '{}', '{"netPay": 200000}' from payroll_runs r cross join employees e;
insert into journal_entries (run_id, entry_date, description, lines) values
  ('20000000-0000-0000-0000-000000000001', '2026-10-31', '10月度 給与支給', '{}'),
  ('20000000-0000-0000-0000-000000000002', '2026-11-30', '11月度 給与支給', '{}');

create function pg_temp.expect(label text, actual bigint, expected bigint) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'NG %: % 件（期待 % 件）', label, actual, expected;
  end if;
  raise notice 'OK %', label;
end $$;

create function pg_temp.expect_error(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'OK % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'NG %: エラーにならなかった', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

-- ── スタッフ1 ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select pg_temp.expect('スタッフは自分の従業員情報だけ', (select count(*) from employees), 1);
select pg_temp.expect('スタッフは自分の条件だけ', (select count(*) from employment_terms), 1);
select pg_temp.expect('スタッフは自分の勤怠だけ', (select count(*) from attendance_days), 1);
select pg_temp.expect('スタッフは確定月の自分の明細だけ', (select count(*) from payslips), 1);
select pg_temp.expect('スタッフは仕訳を見られない', (select count(*) from journal_entries), 0);
select pg_temp.expect('スタッフは操作履歴を見られない', (select count(*) from audit_log), 0);
select pg_temp.expect('スタッフは他人の会員情報を見られない', (select count(*) from members), 1);
select pg_temp.expect_error('スタッフは勤怠を直接書き換えられない',
  $$insert into attendance_days (employee_id, work_date, status) values ('10000000-0000-0000-0000-000000000001', '2026-10-02', '出勤')$$);
-- 他人の勤怠の更新は0件になる（権限者の確認で検証）
update attendance_days set status = '公休' where employee_id = '10000000-0000-0000-0000-000000000002';
select pg_temp.expect_error('スタッフは自分の役割を変えられない',
  $q$do $x$ begin update members set role = 'admin' where user_id = auth.uid(); if not found then raise exception '更新0件'; end if; end $x$$q$);
select pg_temp.expect_error('スタッフは料率を変えられない',
  $$insert into rate_settings (pay_date, label, settings) values ('2026-12-31', '12月度', '{}')$$);
select pg_temp.expect_error('スタッフは他人名義で申請できない',
  $$insert into requests (employee_id, kind, target_date) values ('10000000-0000-0000-0000-000000000002', '有休', '2026-11-01')$$);
insert into requests (employee_id, kind, target_date) values ('10000000-0000-0000-0000-000000000001', '有休', '2026-11-01');
select pg_temp.expect('スタッフは自分の申請を出せる', (select count(*) from requests), 1);
select punch('in');
select pg_temp.expect('打刻で今日の勤怠ができる', (select count(*) from attendance_days), 2);

-- ── 経理担当 ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.expect('経理は自分の勤怠だけ', (select count(*) from attendance_days), 1);
select pg_temp.expect('経理は自分の明細だけ', (select count(*) from payslips), 1);
select pg_temp.expect('経理は確定月の仕訳を見られる', (select count(*) from journal_entries), 1);
select pg_temp.expect('経理は他人の条件を見られない', (select count(*) from employment_terms), 1);

-- ── 権限者 ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect('権限者は全員の勤怠', (select count(*) from attendance_days), 4);
select pg_temp.expect('スタッフによる他人の勤怠の更新は効いていない', (select count(*) from attendance_days where status = '公休'), 0);
select pg_temp.expect('権限者は全員・全月の明細', (select count(*) from payslips), 6);
select pg_temp.expect('権限者は全部の仕訳', (select count(*) from journal_entries), 2);
select pg_temp.expect('権限者は操作履歴を見られる', (select least(count(*), 1) from audit_log), 1);
select pg_temp.expect_error('確定済みの明細は権限者でも変更できない',
  $$update payslips set note = 'x' where run_id = '20000000-0000-0000-0000-000000000001'$$);
update payslips set note = '下書きは直せる' where run_id = '20000000-0000-0000-0000-000000000002';
select pg_temp.expect('下書きの明細は直せる', (select count(*) from payslips where note is not null), 3);

-- ── 社長以外の権限者（社労士）も同じ権限 ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.expect('社労士も全員の勤怠を見られる', (select count(*) from attendance_days), 4);
update members set role = 'accounting' where user_id = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect('権限者は役割を付け替えられる', (select count(*) from members where role = 'accounting'), 2);

-- ── ログインしていない ──
reset role;
set role anon;
select pg_temp.expect_error('ログインしていない人は読めない', $$select count(*) from employees$$);
reset role;
\echo 'ALL RLS TESTS PASSED'
