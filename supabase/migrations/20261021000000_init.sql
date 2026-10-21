-- ヒデ工房 社内アプリ 初期スキーマ
-- 見える範囲はすべて行単位セキュリティ（RLS）で決める。画面の作りに関係なく、
-- スタッフは本人の行しか読めず、経理担当は本人分＋経理（仕訳）だけ、権限者は全員分を読める。

create extension if not exists pgcrypto;

-- ───────── 役割 ─────────
-- admin      : 権限者（社長・社労士・会計士）。全員の情報を見られ、設定を変えられる
-- accounting : 経理担当。本人の勤怠・給与と、確定した給与仕訳だけを見られる
-- staff      : 社員・パート。本人の情報だけを見られる
create type app_role as enum ('admin', 'accounting', 'staff');

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null default 'staff',
  display_name text not null,
  is_owner boolean not null default false, -- 社長。役割の付け替えができるのはこの人だけ
  created_at timestamptz not null default now()
);

-- ───────── 従業員 ─────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text unique,
  name text not null,
  user_id uuid unique references public.members (user_id) on delete set null,
  contract text not null,                 -- 正社員 / パート / 役員 など
  pay_type text not null check (pay_type in ('役員', '月給', '時給')),
  hired_on date,
  retired_on date,
  -- 勤怠の個別ルール（計算開始時刻・休憩なし）
  attendance_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 支給・控除の条件。改定ごとに行を足し、適用開始の支給日で使い分ける（過去の条件は消さない）
create table public.employment_terms (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  effective_from date not null,           -- この支給日から適用
  terms jsonb not null,                   -- src/payroll/types.ts の EmployeeTerms
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);

-- ───────── 会社の設定・料率（履歴で持つ） ─────────
create table public.company_rules (
  effective_from date primary key,
  rules jsonb not null,                   -- CompanyRules
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.rate_settings (
  pay_date date primary key,              -- 月度の支給日
  label text not null,                    -- 「10月度」など
  settings jsonb not null,                -- MonthSettings
  status text not null default 'approved' check (status in ('draft', 'approved')),
  source_url text,                        -- 自動検知した改定の出典
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.tax_tables (
  name text primary key,                  -- 「令和9年分」など
  table_data jsonb not null,
  created_at timestamptz not null default now()
);

-- ───────── 勤怠 ─────────
create table public.attendance_days (
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  status text not null default '',
  clock_in time,
  clock_out time,
  break_minutes int,                      -- その日だけの休憩の指定（通常は自動判定）
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (employee_id, work_date)
);

-- 打刻修正・有休などの申請。承認されたら権限者が勤怠に反映する
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  kind text not null check (kind in ('打刻修正', '有休', '半休')),
  target_date date not null,
  detail jsonb not null default '{}'::jsonb,
  reason text,
  status text not null default '申請中' check (status in ('申請中', '承認', '却下')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── 給与 ─────────
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  pay_date date not null unique,
  label text not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payslips (
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  input jsonb not null,                   -- MonthlyInput（勤怠集計＋手入力）
  result jsonb not null,                  -- PayrollResult
  note text,
  primary key (run_id, employee_id)
);

-- 給与仕訳は科目ごとの合計だけを持つ（個人別の金額は入れない）
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.payroll_runs (id) on delete cascade,
  entry_date date not null,
  description text not null,
  lines jsonb not null,                   -- { debits: JournalLine[], credits: JournalLine[] }
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── 操作履歴 ─────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  table_name text not null,
  action text not null,
  row_key text,
  before jsonb,
  after jsonb
);

-- ───────── 権限の判定 ─────────
create function public.current_role_name() returns app_role
  language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

create function public.is_accounting() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'accounting', false)
$$;

create function public.is_owner() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.members where user_id = auth.uid()), false)
$$;

create function public.my_employee_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid()
$$;

-- ───────── 行単位セキュリティ ─────────
alter table public.members enable row level security;
alter table public.employees enable row level security;
alter table public.employment_terms enable row level security;
alter table public.company_rules enable row level security;
alter table public.rate_settings enable row level security;
alter table public.tax_tables enable row level security;
alter table public.attendance_days enable row level security;
alter table public.requests enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.journal_entries enable row level security;
alter table public.audit_log enable row level security;

-- 権限者は全テーブルを読み書きできる
do $$
declare t text;
begin
  foreach t in array array['employees', 'employment_terms', 'company_rules', 'rate_settings',
                           'tax_tables', 'attendance_days', 'requests', 'payroll_runs', 'payslips',
                           'journal_entries']
  loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- 利用者と役割は権限者が見られるが、付け替えは社長だけ
create policy admin_read on public.members for select to authenticated using (public.is_admin());
create policy owner_write on public.members for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy admin_read on public.audit_log for select to authenticated using (public.is_admin());

-- 本人の分
create policy self_read on public.members for select to authenticated using (user_id = auth.uid());
create policy self_read on public.employees for select to authenticated using (user_id = auth.uid());
create policy self_read on public.employment_terms for select to authenticated
  using (employee_id = public.my_employee_id());
create policy self_read on public.attendance_days for select to authenticated
  using (employee_id = public.my_employee_id());
create policy self_read on public.requests for select to authenticated
  using (employee_id = public.my_employee_id());
create policy self_create on public.requests for insert to authenticated
  with check (employee_id = public.my_employee_id() and status = '申請中' and decided_by is null);

-- 給与明細は、確定した月の本人分だけ
create policy self_read on public.payslips for select to authenticated
  using (employee_id = public.my_employee_id()
         and exists (select 1 from public.payroll_runs r where r.id = run_id and r.status = 'confirmed'));
create policy confirmed_read on public.payroll_runs for select to authenticated using (status = 'confirmed');

-- 料率・税額表・会社のルールは全員が読める（個人情報を含まない）。変更は権限者だけ
create policy all_read on public.company_rules for select to authenticated using (true);
create policy all_read on public.rate_settings for select to authenticated using (status = 'approved');
create policy all_read on public.tax_tables for select to authenticated using (true);

-- 経理担当は確定した給与仕訳を読め、書き出し日時だけ記録できる
create policy accounting_read on public.journal_entries for select to authenticated
  using (public.is_accounting()
         and exists (select 1 from public.payroll_runs r where r.id = run_id and r.status = 'confirmed'));

-- ───────── 打刻（本人が今日の分だけ） ─────────
-- 直接の書き込みは許さず、この関数だけで出勤・退勤を記録する。時刻はサーバーの時計（日本時間）を使う。
create function public.punch(kind text) returns public.attendance_days
  language plpgsql security definer set search_path = public as $$
declare
  emp uuid := public.my_employee_id();
  now_jst timestamp := now() at time zone 'Asia/Tokyo';
  row public.attendance_days;
begin
  if emp is null then
    raise exception '従業員として登録されていません';
  end if;
  if kind = 'in' then
    insert into public.attendance_days (employee_id, work_date, status, clock_in)
    values (emp, now_jst::date, '出勤', date_trunc('minute', now_jst)::time)
    on conflict (employee_id, work_date) do update
      set clock_in = coalesce(public.attendance_days.clock_in, excluded.clock_in),
          status = case when public.attendance_days.status = '' then '出勤' else public.attendance_days.status end,
          updated_by = auth.uid(), updated_at = now()
    returning * into row;
  elsif kind = 'out' then
    update public.attendance_days
      set clock_out = date_trunc('minute', now_jst)::time, updated_by = auth.uid(), updated_at = now()
      where employee_id = emp and work_date = now_jst::date and clock_in is not null
      returning * into row;
    if row is null then
      raise exception '今日の出勤打刻がありません';
    end if;
  else
    raise exception '打刻の種類が不正です: %', kind;
  end if;
  return row;
end $$;

revoke all on function public.punch(text) from public;
grant execute on function public.punch(text) to authenticated;

-- 経理担当が給与仕訳を書き出したことを記録する
create function public.mark_journal_exported(entry uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_accounting()) then
    raise exception '権限がありません';
  end if;
  update public.journal_entries set exported_at = now() where id = entry;
end $$;

revoke all on function public.mark_journal_exported(uuid) from public;
grant execute on function public.mark_journal_exported(uuid) to authenticated;

-- ───────── 操作履歴の自動記録 ─────────
create function public.write_audit() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, action, row_key, before, after)
  values (tg_table_name, tg_op,
          coalesce(to_jsonb(new), to_jsonb(old)) ->> (tg_argv[0]),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit after insert or update or delete on public.members
  for each row execute function public.write_audit('user_id');
create trigger audit after insert or update or delete on public.employment_terms
  for each row execute function public.write_audit('employee_id');
create trigger audit after insert or update or delete on public.company_rules
  for each row execute function public.write_audit('effective_from');
create trigger audit after insert or update or delete on public.rate_settings
  for each row execute function public.write_audit('pay_date');
create trigger audit after insert or update or delete on public.attendance_days
  for each row execute function public.write_audit('employee_id');
create trigger audit after insert or update or delete on public.payroll_runs
  for each row execute function public.write_audit('pay_date');
create trigger audit after insert or update or delete on public.payslips
  for each row execute function public.write_audit('employee_id');

-- 確定した給与は書き換えない（訂正は新しい月度で行う）
create function public.block_confirmed_payslip_change() returns trigger
  language plpgsql as $$
begin
  if exists (select 1 from public.payroll_runs r where r.id = coalesce(old.run_id, new.run_id) and r.status = 'confirmed') then
    raise exception '確定済みの給与は変更できません';
  end if;
  return coalesce(new, old);
end $$;

create trigger lock_confirmed before update or delete on public.payslips
  for each row execute function public.block_confirmed_payslip_change();
