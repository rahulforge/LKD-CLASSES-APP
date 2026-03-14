-- LKD Classes non-destructive migration
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

-- Seed classes
insert into public.classes (name)
select x.name
from (values
  ('Class 6'),
  ('Class 7'),
  ('Class 8'),
  ('Class 9'),
  ('Class 10'),
  ('Class 11'),
  ('Class 12'),
  ('Competitive')
) as x(name)
where not exists (
  select 1 from public.classes c
  where lower(replace(c.name, ' ', '')) = lower(replace(x.name, ' ', ''))
);

-- Roll config
create table if not exists public.roll_number_configs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes(id) on delete cascade,
  online_start int not null default 10001,
  online_next int not null default 10001,
  offline_start int not null default 50001,
  offline_next int not null default 50001,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Students required fields
alter table if exists public.students add column if not exists user_id uuid;
alter table if exists public.students add column if not exists name text;
alter table if exists public.students add column if not exists phone text;
alter table if exists public.students add column if not exists class_id uuid;
alter table if exists public.students add column if not exists category text;
alter table if exists public.students add column if not exists student_type text;
alter table if exists public.students add column if not exists admission_paid boolean default false;
alter table if exists public.students add column if not exists app_access_paid boolean default false;
alter table if exists public.students add column if not exists payment_status text default 'pending';
alter table if exists public.students add column if not exists roll_number text;
alter table if exists public.students add column if not exists created_at timestamptz default now();
alter table if exists public.students add column if not exists admission_date date default current_date;

create unique index if not exists students_user_id_ux on public.students(user_id);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists students_roll_idx on public.students(roll_number);
create index if not exists students_admission_date_idx on public.students(admission_date);
create unique index if not exists students_roll_unique_idx on public.students(roll_number) where roll_number is not null;
create unique index if not exists students_phone_unique_idx on public.students(phone)
where phone is not null and btrim(phone) <> '';

alter table if exists public.profiles enable row level security;
alter table if exists public.students enable row level security;

create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  );
$$;

grant execute on function public.is_teacher() to authenticated;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_teacher_read_students" on public.profiles;
create policy "profiles_teacher_read_students"
on public.profiles
for select
to authenticated
using (
  role = 'student'
  and public.is_teacher()
);

drop policy if exists "profiles_teacher_update_students" on public.profiles;
create policy "profiles_teacher_update_students"
on public.profiles
for update
to authenticated
using (
  role = 'student'
  and public.is_teacher()
)
with check (
  role = 'student'
  and public.is_teacher()
);

drop policy if exists "students_self_read" on public.students;
create policy "students_self_read"
on public.students
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "students_self_insert" on public.students;
create policy "students_self_insert"
on public.students
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "students_self_update" on public.students;
create policy "students_self_update"
on public.students
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "students_teacher_manage" on public.students;
create policy "students_teacher_manage"
on public.students
for all
to authenticated
using (
  public.is_teacher()
)
with check (
  public.is_teacher()
);

update public.students
set admission_date = coalesce(admission_date, (created_at at time zone 'asia/kolkata')::date, current_date)
where admission_date is null;

update public.students
set app_access_paid = coalesce(app_access_paid, admission_paid, false)
where app_access_paid is null;

-- Normalize roll starts
update public.roll_number_configs
set
  online_start = greatest(coalesce(online_start, 10001), 10001),
  online_next = greatest(coalesce(online_next, 10001), 10001),
  offline_start = greatest(coalesce(offline_start, online_start, 10001), 10001),
  offline_next = greatest(coalesce(offline_next, online_next, 10001), 10001);

drop trigger if exists trg_assign_student_roll on public.students;

create or replace function public.assign_roll_for_class(
  p_class_id uuid,
  p_student_type text default 'online'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
  next_no int;
  final_roll text;
begin
  if p_class_id is null then
    return null;
  end if;

  select * into cfg
  from public.roll_number_configs
  where class_id = p_class_id
  for update;

  if not found then
    insert into public.roll_number_configs (
      class_id, online_start, online_next, offline_start, offline_next
    ) values (
      p_class_id, 10001, 10001, 50001, 50001
    )
    on conflict (class_id) do nothing;

    select * into cfg
    from public.roll_number_configs
    where class_id = p_class_id
    for update;
  end if;

  next_no := cfg.online_next;
  update public.roll_number_configs
  set online_next = cfg.online_next + 1,
      offline_next = cfg.online_next + 1,
      updated_at = now()
  where class_id = p_class_id;

  final_roll := lpad(next_no::text, 5, '0');
  return final_roll;
end;
$$;

grant execute on function public.assign_roll_for_class(uuid, text) to authenticated;

create or replace function public.trg_set_student_roll()
returns trigger
language plpgsql
as $$
begin
  if new.roll_number is null or btrim(new.roll_number) = '' then
    if coalesce(new.app_access_paid, false) = false and coalesce(new.admission_paid, false) = false then
      return new;
    end if;
    new.roll_number := public.assign_roll_for_class(new.class_id, new.student_type);
  else
    new.roll_number := lpad(regexp_replace(new.roll_number, '\D', '', 'g'), 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_assign_student_roll
before insert on public.students
for each row execute function public.trg_set_student_roll();

create or replace function public.sync_profile_to_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if coalesce(new.role, '') <> 'student' then
    return new;
  end if;

  -- Only link profile to existing student rows (students is source of truth).
  if new.phone is not null and btrim(new.phone) <> '' then
    update public.students
    set user_id = new.id
    where user_id is null
      and phone = new.phone;
  end if;
  if new.roll_number is not null and btrim(new.roll_number) <> '' then
    update public.students
    set user_id = new.id
    where user_id is null
      and roll_number = new.roll_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_to_student on public.profiles;
create trigger trg_sync_profile_to_student
after insert or update on public.profiles
for each row execute function public.sync_profile_to_student();

create or replace function public.sync_student_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.user_id is null then
    return new;
  end if;

  update public.profiles
  set
    name = coalesce(new.name, public.profiles.name),
    phone = coalesce(new.phone, public.profiles.phone),
    class = coalesce(new.class_id, public.profiles.class),
    program_type = case when coalesce(new.category, 'school') = 'competitive' then 'competitive' else 'school' end,
    student_type = case when coalesce(new.student_type, 'online') = 'offline' then 'offline' else 'online' end,
    admission_paid = coalesce(new.admission_paid, public.profiles.admission_paid),
    app_access_paid = coalesce(new.app_access_paid, public.profiles.app_access_paid),
    roll_number = coalesce(new.roll_number, public.profiles.roll_number)
  where id = new.user_id
    and role = 'student';

  return new;
end;
$$;

drop trigger if exists trg_sync_student_to_profile on public.students;
create trigger trg_sync_student_to_profile
after insert or update on public.students
for each row execute function public.sync_student_to_profile();

-- Roll assignment RPC (call after successful payment)
create or replace function public.assign_roll_for_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  cfg record;
  next_no int;
  final_roll text;
begin
  select id, class_id, student_type, roll_number
  into s
  from public.students
  where user_id = p_user_id
  limit 1;

  if s.id is null then
    return null;
  end if;

  if s.roll_number is not null and btrim(s.roll_number) <> '' then
    return s.roll_number;
  end if;

  if s.class_id is null then
    return null;
  end if;

  select * into cfg
  from public.roll_number_configs
  where class_id = s.class_id
  for update;

  if not found then
    insert into public.roll_number_configs (
      class_id, online_start, online_next, offline_start, offline_next
    ) values (
      s.class_id, 10001, 10001, 50001, 50001
    )
    on conflict (class_id) do nothing;

    select * into cfg
    from public.roll_number_configs
    where class_id = s.class_id
    for update;
  end if;

  next_no := cfg.online_next;
  loop
    final_roll := lpad(next_no::text, 5, '0');
    exit when not exists (
      select 1
      from public.students
      where roll_number = final_roll
    );
    next_no := next_no + 1;
  end loop;

  update public.roll_number_configs
  set online_next = next_no + 1,
      offline_next = next_no + 1,
      updated_at = now()
  where class_id = s.class_id;

  update public.students
  set roll_number = final_roll
  where id = s.id;

  update public.profiles
  set roll_number = final_roll
  where id = p_user_id;

  return final_roll;
end;
$$;

grant execute on function public.assign_roll_for_user(uuid) to authenticated;

-- Backfill students from profiles
do $$
declare
  fallback_school uuid;
  fallback_comp uuid;
begin
  select id into fallback_school from public.classes where lower(name) like '%class 6%' limit 1;
  if fallback_school is null then
    select id into fallback_school from public.classes where lower(name) like '%class%' order by name limit 1;
  end if;

  select id into fallback_comp from public.classes where lower(name) like '%competitive%' limit 1;
  if fallback_comp is null then
    fallback_comp := fallback_school;
  end if;

  insert into public.students (
    user_id, name, phone, class_id, category, student_type,
    admission_paid, payment_status, roll_number, admission_date
  )
  select
    p.id,
    coalesce(p.name, 'Student'),
    p.phone,
    coalesce(
      p.class,
      case when coalesce(p.program_type, 'school') = 'competitive' then fallback_comp else fallback_school end
    ),
    case when coalesce(p.program_type, 'school') = 'competitive' then 'competitive' else 'school' end,
    coalesce(p.student_type, 'online'),
    coalesce(p.admission_paid, false),
    coalesce(p.payment_status, 'pending'),
    null,
    coalesce((p.created_at at time zone 'asia/kolkata')::date, current_date)
  from public.profiles p
  where p.role = 'student'
    and not exists (select 1 from public.students s where s.user_id = p.id)
    and coalesce(
      p.class,
      case when coalesce(p.program_type, 'school') = 'competitive' then fallback_comp else fallback_school end
    ) is not null;
end $$;

-- Keep short numeric rolls padded to 5 digits
update public.students
set roll_number = lpad(regexp_replace(roll_number, '\D', '', 'g'), 5, '0')
where roll_number is not null
  and regexp_replace(roll_number, '\D', '', 'g') ~ '^[0-9]+$'
  and length(regexp_replace(roll_number, '\D', '', 'g')) < 5;

update public.profiles
set roll_number = lpad(regexp_replace(roll_number, '\D', '', 'g'), 5, '0')
where roll_number is not null
  and regexp_replace(roll_number, '\D', '', 'g') ~ '^[0-9]+$'
  and length(regexp_replace(roll_number, '\D', '', 'g')) < 5;

update public.profiles p
set
  class = s.class_id,
  roll_number = coalesce(s.roll_number, p.roll_number),
  student_type = coalesce(s.student_type, p.student_type),
  app_access_paid = coalesce(s.app_access_paid, p.app_access_paid),
  admission_paid = coalesce(s.admission_paid, p.admission_paid)
from public.students s
where s.user_id = p.id
  and p.role = 'student'
  and (
    p.class is distinct from s.class_id
    or p.roll_number is distinct from s.roll_number
    or p.student_type is distinct from s.student_type
    or p.app_access_paid is distinct from s.app_access_paid
    or p.admission_paid is distinct from s.admission_paid
  );

-- Backfill profile name/phone from students (one-time sync)
update public.profiles p
set
  name = coalesce(s.name, p.name),
  phone = coalesce(s.phone, p.phone)
from public.students s
where s.user_id = p.id
  and p.role = 'student'
  and (
    p.name is distinct from s.name
    or p.phone is distinct from s.phone
  );

alter table if exists public.profiles add column if not exists app_access_paid boolean default false;

update public.profiles
set app_access_paid = coalesce(app_access_paid, admission_paid, false)
where app_access_paid is null;

-- Class fee config (monthly only)
create table if not exists public.class_fee_configs (
  class_id uuid primary key references public.classes(id) on delete cascade,
  monthly_fee numeric(10,2) not null default 0,
  test_fee numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table if exists public.class_fee_configs
  add column if not exists monthly_fee numeric(10,2) not null default 0;
alter table if exists public.class_fee_configs
  add column if not exists test_fee numeric(10,2) not null default 0;

alter table if exists public.class_fee_configs
  drop column if exists monthly_full_fee,
  drop column if exists monthly_half_fee,
  drop column if exists admission_fee;

update public.class_fee_configs
set monthly_fee = coalesce(monthly_fee, 0)
where monthly_fee is null;
update public.class_fee_configs
set test_fee = coalesce(test_fee, monthly_fee, 0)
where test_fee is null;

-- Keep one latest config row per class (for legacy databases that allowed duplicates)
with ranked as (
  select
    ctid,
    row_number() over (
      partition by class_id
      order by updated_at desc nulls last, class_id
    ) as rn
  from public.class_fee_configs
)
delete from public.class_fee_configs t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists class_fee_configs_class_id_ux
  on public.class_fee_configs(class_id);

alter table if exists public.class_fee_configs enable row level security;

drop policy if exists "class_fee_configs_read_auth" on public.class_fee_configs;
create policy "class_fee_configs_read_auth"
on public.class_fee_configs
for select
to authenticated
using (true);

drop policy if exists "class_fee_configs_teacher_manage" on public.class_fee_configs;
create policy "class_fee_configs_teacher_manage"
on public.class_fee_configs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

create or replace function public.get_class_fee_config(p_class_id uuid)
returns table (
  class_id uuid,
  monthly_fee numeric,
  test_fee numeric,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_name text;
begin
  if p_class_id is null then
    return;
  end if;

  select c.name
  into v_name
  from public.classes c
  where c.id = p_class_id
  limit 1;

  if v_name is null then
    return query
    select
      cfg.class_id,
      cfg.monthly_fee,
      coalesce(cfg.test_fee, cfg.monthly_fee),
      cfg.updated_at
    from public.class_fee_configs cfg
    where cfg.class_id = p_class_id
    order by cfg.updated_at desc nulls last
    limit 1;
    return;
  end if;

  return query
  select
    cfg.class_id,
    cfg.monthly_fee,
    coalesce(cfg.test_fee, cfg.monthly_fee),
    cfg.updated_at
  from public.class_fee_configs cfg
  join public.classes cls on cls.id = cfg.class_id
  where lower(regexp_replace(cls.name, '\s+', '', 'g')) =
        lower(regexp_replace(v_name, '\s+', '', 'g'))
  order by cfg.updated_at desc nulls last
  limit 1;
end;
$$;

grant execute on function public.get_class_fee_config(uuid) to authenticated;

create or replace function public.touch_class_fee_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_class_fee_updated_at on public.class_fee_configs;
create trigger trg_touch_class_fee_updated_at
before update on public.class_fee_configs
for each row execute function public.touch_class_fee_updated_at();

-- Specific class fee update (Class 10 example)
update public.class_fee_configs
set
  monthly_fee = 10000,
  updated_at = now()
where class_id = 'f9b88830-22a4-4445-b1d5-6c0691fda55b';

-- Promo codes improvements for online/offline identity
alter table if exists public.promo_codes add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table if exists public.promo_codes add column if not exists discount_percent int default 0;
alter table if exists public.promo_codes add column if not exists student_type text default 'online';
alter table if exists public.promo_codes add column if not exists is_active boolean default true;
create unique index if not exists promo_codes_code_ux on public.promo_codes(code);
create index if not exists promo_codes_class_idx on public.promo_codes(class_id);

-- Live sessions hierarchy mapping (backward compatible)
alter table if exists public.live_sessions add column if not exists subject_id uuid references public.subjects(id) on delete set null;
alter table if exists public.live_sessions add column if not exists chapter_id uuid references public.chapters(id) on delete set null;
create index if not exists live_sessions_subject_idx on public.live_sessions(subject_id);
create index if not exists live_sessions_chapter_idx on public.live_sessions(chapter_id);

-- Mock tests duration support (teacher controlled timer)
alter table if exists public.mock_tests
  add column if not exists duration_minutes int not null default 60;

-- Mock tests scoring support (+ for correct, - for wrong)
alter table if exists public.mock_tests
  add column if not exists marks_per_question numeric(6,2) not null default 1;
alter table if exists public.mock_tests
  add column if not exists negative_marks numeric(6,2) not null default 0;
alter table if exists public.mock_tests
  add column if not exists is_free boolean not null default false;
alter table if exists public.mock_tests
  add column if not exists price numeric(10,2) not null default 0;

update public.mock_tests
set price = 0
where price is null;

create index if not exists mock_tests_price_idx
  on public.mock_tests(price);

-- Mock tests access policies
alter table public.mock_tests enable row level security;

drop policy if exists "mock_tests_select_auth" on public.mock_tests;
create policy "mock_tests_select_auth"
on public.mock_tests
for select
to authenticated
using (true);

drop policy if exists "mock_tests_teacher_manage" on public.mock_tests;
create policy "mock_tests_teacher_manage"
on public.mock_tests
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

-- Mock test questions access (visible to authenticated who can see tests)
alter table public.mock_test_questions enable row level security;

drop policy if exists "mock_test_questions_select_auth" on public.mock_test_questions;
create policy "mock_test_questions_select_auth"
on public.mock_test_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.mock_tests t
    where t.id = mock_test_id
  )
);

drop policy if exists "mock_test_questions_teacher_manage" on public.mock_test_questions;
create policy "mock_test_questions_teacher_manage"
on public.mock_test_questions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

-- Lecture/material access flags (paid/free)
alter table if exists public.lectures
  add column if not exists is_free boolean not null default false;
alter table if exists public.materials
  add column if not exists is_preview boolean not null default false;

update public.lectures
set is_free = false
where is_free is null;

update public.materials
set is_preview = false
where is_preview is null;

create index if not exists lectures_chapter_free_idx
  on public.lectures(chapter_id, is_free);
create index if not exists materials_chapter_preview_idx
  on public.materials(chapter_id, is_preview);

-- Mock test results summary (per attempt)
create table if not exists public.mock_test_results (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  score numeric(10,2) not null default 0,
  correct int not null default 0,
  wrong int not null default 0,
  total int not null default 0,
  submitted_at timestamptz not null default now()
);

-- Mock test payments (extra paid tests)
create table if not exists public.mock_test_payments (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  status text not null default 'success',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists mock_test_payments_user_test_ux
  on public.mock_test_payments(user_id, mock_test_id);
create index if not exists mock_test_payments_test_idx
  on public.mock_test_payments(mock_test_id);

alter table public.mock_test_payments enable row level security;

drop policy if exists "mock_test_payments_select_own_or_teacher" on public.mock_test_payments;
create policy "mock_test_payments_select_own_or_teacher"
on public.mock_test_payments
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists "mock_test_payments_insert_own" on public.mock_test_payments;
create policy "mock_test_payments_insert_own"
on public.mock_test_payments
for insert
to authenticated
with check (auth.uid() = user_id);

create index if not exists mock_test_results_test_idx
  on public.mock_test_results(mock_test_id);
create index if not exists mock_test_results_student_idx
  on public.mock_test_results(student_id);

-- Ensure result rows can store answer breakdown from excel imports
alter table if exists public.results
  add column if not exists correct int;
alter table if exists public.results
  add column if not exists wrong int;

-- Device push tokens (for closed-app notifications)
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete set null,
  expo_push_token text not null,
  platform text not null default 'android',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz null
);

create unique index if not exists device_push_tokens_user_token_ux
  on public.device_push_tokens(user_id, expo_push_token);
create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens(user_id);
create index if not exists device_push_tokens_class_idx
  on public.device_push_tokens(class_id);
create index if not exists device_push_tokens_active_idx
  on public.device_push_tokens(is_active);

create or replace function public.touch_device_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_device_push_tokens_updated_at on public.device_push_tokens;
create trigger trg_touch_device_push_tokens_updated_at
before update on public.device_push_tokens
for each row execute function public.touch_device_push_tokens_updated_at();

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_tokens_select_own_or_teacher" on public.device_push_tokens;
create policy "device_tokens_select_own_or_teacher"
on public.device_push_tokens
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists "device_tokens_insert_own" on public.device_push_tokens;
create policy "device_tokens_insert_own"
on public.device_push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "device_tokens_update_own_or_teacher" on public.device_push_tokens;
create policy "device_tokens_update_own_or_teacher"
on public.device_push_tokens
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists "device_tokens_delete_own" on public.device_push_tokens;
create policy "device_tokens_delete_own"
on public.device_push_tokens
for delete
to authenticated
using (auth.uid() = user_id);

-- Subscription plans (single source for app + website pricing)
create table if not exists public.subscription_plans (
  code text primary key,
  title text not null,
  description text null,
  amount numeric(10,2) not null check (amount >= 0),
  duration_months int not null check (duration_months > 0),
  badge text null,
  details text[] not null default '{}'::text[],
  is_active boolean not null default true,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_subscription_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_subscription_plans_updated_at on public.subscription_plans;
create trigger trg_touch_subscription_plans_updated_at
before update on public.subscription_plans
for each row execute function public.touch_subscription_plans_updated_at();

insert into public.subscription_plans (code, title, description, amount, duration_months, badge, details, is_active, sort_order)
values
  ('monthly', 'Monthly', 'Best for trial', 499, 1, 'Best for trial', array['All lectures','All materials','All mock tests','Live updates'], true, 1),
  ('half_year', '6 Months', 'Most popular', 2499, 6, 'Most popular', array['Everything in Monthly','Priority support','Doubt assistance','Performance tracking'], true, 2),
  ('yearly', '1 Year', 'Best value', 4499, 12, 'Best value', array['Everything in 6 Months','Full year access','Exam strategy modules','Revision resources'], true, 3)
on conflict (code) do update
set
  title = excluded.title,
  description = excluded.description,
  amount = excluded.amount,
  duration_months = excluded.duration_months,
  badge = excluded.badge,
  details = excluded.details,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.subscription_plans enable row level security;

drop policy if exists "subscription_plans_read_active" on public.subscription_plans;
create policy "subscription_plans_read_active"
on public.subscription_plans
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "subscription_plans_teacher_manage" on public.subscription_plans;
create policy "subscription_plans_teacher_manage"
on public.subscription_plans
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

-- Subscriptions (student access records)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default false,
  expires_at timestamptz null,
  plan_type text null,
  plan_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.subscriptions
  add column if not exists plan_code text;

create or replace function public.touch_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_subscriptions_updated_at on public.subscriptions;
create trigger trg_touch_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.touch_subscriptions_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own_or_teacher" on public.subscriptions;
create policy "subscriptions_select_own_or_teacher"
on public.subscriptions
for select
to authenticated
using (
  public.is_teacher()
  or user_id = auth.uid()
);

drop policy if exists "subscriptions_insert_teacher_or_owner" on public.subscriptions;
create policy "subscriptions_insert_teacher_or_owner"
on public.subscriptions
for insert
to authenticated
with check (
  public.is_teacher()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.payments p
      where p.user_id = auth.uid()
        and lower(p.status) in ('success','paid','completed','succeeded','done','ok')
        and p.created_at > now() - interval '2 hours'
    )
  )
);

drop policy if exists "subscriptions_update_teacher_or_owner" on public.subscriptions;
create policy "subscriptions_update_teacher_or_owner"
on public.subscriptions
for update
to authenticated
using (
  public.is_teacher()
  or user_id = auth.uid()
)
with check (
  public.is_teacher()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.payments p
      where p.user_id = auth.uid()
        and lower(p.status) in ('success','paid','completed','succeeded','done','ok')
        and p.created_at > now() - interval '2 hours'
    )
  )
);

drop policy if exists "subscriptions_delete_teacher" on public.subscriptions;
create policy "subscriptions_delete_teacher"
on public.subscriptions
for delete
to authenticated
using (public.is_teacher());

-- Payment tracking upgrades (online monthly + app access)
alter table if exists public.payment_tracking add column if not exists paid_month date;
alter table if exists public.payment_tracking add column if not exists payment_kind text default 'offline_monthly';
alter table if exists public.payment_tracking add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table if exists public.payment_tracking add column if not exists student_type text;

do $$
declare
  v_con record;
begin
  if to_regclass('public.payment_tracking') is null then
    return;
  end if;

  for v_con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.payment_tracking'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.payment_tracking drop constraint if exists %I', v_con.conname);
  end loop;
end;
$$;

alter table if exists public.payment_tracking
  alter column status set default 'success';

update public.payment_tracking
set status = case
  when lower(coalesce(status, '')) in ('success', 'paid', 'succeeded', 'done', 'completed') then 'success'
  when lower(coalesce(status, '')) in ('pending', 'processing', 'unpaid', 'due') then 'pending'
  else 'failed'
end;

alter table if exists public.payment_tracking
  add constraint payment_tracking_status_check
  check (lower(status) in ('success', 'pending', 'failed', 'paid'));

update public.payment_tracking
set payment_kind = 'offline_monthly'
where payment_kind is null;

with ranked as (
  select
    ctid,
    row_number() over (
      partition by roll_number, paid_month, payment_kind
      order by paid_date desc nulls last, id
    ) as rn
  from public.payment_tracking
  where paid_month is not null
)
delete from public.payment_tracking t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

create index if not exists payment_tracking_kind_idx on public.payment_tracking(payment_kind);
create index if not exists payment_tracking_roll_month_idx on public.payment_tracking(roll_number, paid_month);
drop index if exists payment_tracking_roll_month_kind_ux;
create unique index if not exists payment_tracking_roll_month_kind_ux
  on public.payment_tracking(roll_number, paid_month, payment_kind);

-- Sync successful online payments into payment_tracking (skip monthly/test since app already tracks those)
create or replace function public.handle_payment_success_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roll text;
  v_class uuid;
  v_type text;
  v_kind text;
  v_mode text;
  v_months jsonb;
  v_month text;
  v_count int;
  v_per numeric;
  v_idx int;
begin
  if lower(coalesce(new.status, '')) <> 'success' then
    return new;
  end if;
  if TG_OP = 'UPDATE' and lower(coalesce(old.status, '')) = 'success' then
    return new;
  end if;

  v_kind := lower(coalesce(new.flow, coalesce(new.metadata ->> 'flow', '')));
  if v_kind = '' then
    v_kind := 'online_other';
  end if;
  v_mode := case when coalesce(new.amount, 0) <= 0 then 'promo' else 'online' end;

  select s.roll_number, s.class_id, s.student_type
  into v_roll, v_class, v_type
  from public.students s
  where s.user_id = new.user_id
  order by s.created_at desc
  limit 1;

  if v_roll is null then
    select p.roll_number, p.class, p.student_type
    into v_roll, v_class, v_type
    from public.profiles p
    where p.id = new.user_id
    limit 1;
  end if;

  if v_roll is null then
    return new;
  end if;

  if v_kind = 'monthly_fee' then
    v_months := new.metadata -> 'months';
    if jsonb_typeof(v_months) = 'array' then
      v_count := jsonb_array_length(v_months);
    else
      v_count := 0;
    end if;
    if v_count > 0 then
      v_per := coalesce(new.amount, 0) / v_count;
      for v_idx in 0..v_count - 1 loop
        v_month := v_months ->> v_idx;
        insert into public.payment_tracking (
          roll_number,
          amount,
          status,
          paid_date,
          paid_month,
          payment_mode,
          payment_kind,
          class_id,
          student_type,
          created_by
        ) values (
          v_roll,
          v_per,
          'success',
          new.created_at::date,
          v_month::date,
          v_mode,
          'online_monthly',
          v_class,
          v_type,
          new.user_id
        )
        on conflict (roll_number, paid_month, payment_kind) do update
        set
          amount = public.payment_tracking.amount + excluded.amount,
          status = 'success',
          payment_mode = excluded.payment_mode,
          paid_date = excluded.paid_date,
          class_id = coalesce(excluded.class_id, public.payment_tracking.class_id),
          student_type = coalesce(excluded.student_type, public.payment_tracking.student_type),
          created_by = coalesce(excluded.created_by, public.payment_tracking.created_by);
      end loop;
      return new;
    end if;
    v_kind := 'online_monthly';
  elsif v_kind = 'test_fee' then
    v_kind := 'test_fee';
  elsif v_kind = 'app_access' then
    v_kind := 'app_access';
  elsif v_kind = 'subscription' then
    v_kind := 'subscription';
  elsif v_kind = 'mock_test' then
    v_kind := 'mock_test';
  end if;

  insert into public.payment_tracking (
    roll_number,
    amount,
    status,
    paid_date,
    paid_month,
    payment_mode,
    payment_kind,
    class_id,
    student_type,
    created_by
  ) values (
    v_roll,
    coalesce(new.amount, 0),
    'success',
    new.created_at::date,
    date_trunc('month', new.created_at)::date,
    v_mode,
    v_kind,
    v_class,
    v_type,
    new.user_id
  )
  on conflict (roll_number, paid_month, payment_kind) do update
  set
    amount = public.payment_tracking.amount + excluded.amount,
    status = 'success',
    payment_mode = excluded.payment_mode,
    paid_date = excluded.paid_date,
    class_id = coalesce(excluded.class_id, public.payment_tracking.class_id),
    student_type = coalesce(excluded.student_type, public.payment_tracking.student_type),
    created_by = coalesce(excluded.created_by, public.payment_tracking.created_by);

  return new;
end;
$$;

drop trigger if exists trg_sync_payment_tracking on public.payments;
create trigger trg_sync_payment_tracking
after update of status on public.payments
for each row execute function public.handle_payment_success_tracking();

drop trigger if exists trg_sync_payment_tracking_insert on public.payments;
create trigger trg_sync_payment_tracking_insert
after insert on public.payments
for each row execute function public.handle_payment_success_tracking();

-- Purge old payments (default: keep successes, delete pending/failed older than 7 days)
create or replace function public.purge_old_payments(
  p_keep_success boolean default true,
  p_days integer default 7
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, coalesce(p_days, 7));
  v_deleted integer := 0;
begin
  delete from public.payments
  where created_at < now() - make_interval(days => v_days)
    and (
      not p_keep_success
      or lower(coalesce(status, '')) <> 'success'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Payment tracking RLS (teacher manage, student read-only for own roll)
create or replace function public.current_user_roll_numbers()
returns text[]
language plpgsql
security definer
as $$
declare
  v_roll text;
  v_student_roll text;
  v_rolls text[];
begin
  select roll_number into v_roll
  from public.profiles
  where id = auth.uid();

  select roll_number into v_student_roll
  from public.students
  where user_id = auth.uid()
  order by created_at desc
  limit 1;

  v_rolls := array_remove(array[v_roll, v_student_roll], null);
  return array(
    select distinct r
    from unnest(v_rolls) as r
    where btrim(r) <> ''
  );
end;
$$;

alter table if exists public.payment_tracking enable row level security;

drop policy if exists "payment_tracking_select_own_or_teacher" on public.payment_tracking;
create policy "payment_tracking_select_own_or_teacher"
on public.payment_tracking
for select
to authenticated
using (
  public.is_teacher()
  or roll_number = any(public.current_user_roll_numbers())
);

drop policy if exists "payment_tracking_insert_teacher" on public.payment_tracking;
create policy "payment_tracking_insert_teacher"
on public.payment_tracking
for insert
to authenticated
with check (public.is_teacher());

drop policy if exists "payment_tracking_update_teacher" on public.payment_tracking;
create policy "payment_tracking_update_teacher"
on public.payment_tracking
for update
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists "payment_tracking_delete_teacher" on public.payment_tracking;
create policy "payment_tracking_delete_teacher"
on public.payment_tracking
for delete
to authenticated
using (public.is_teacher());

-- Live sessions access helpers/policies
create or replace function public.current_user_class_ids()
returns uuid[]
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_class_id uuid;
  v_class_name text;
  v_ids uuid[];
begin
  select s.class_id
  into v_class_id
  from public.students s
  where s.user_id = auth.uid()
    and s.class_id is not null
  order by s.created_at desc nulls last
  limit 1;

  if v_class_id is not null then
    select c.name into v_class_name
    from public.classes c
    where c.id = v_class_id
    limit 1;
  else
    select
      case
        when (p.class::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
          then p.class::uuid
        else null
      end
    into v_class_id
    from public.profiles p
    where p.id = auth.uid()
    limit 1;

    if v_class_id is not null then
      select c.name into v_class_name
      from public.classes c
      where c.id = v_class_id
      limit 1;
    else
      select nullif(trim(p.class::text), '')
      into v_class_name
      from public.profiles p
      where p.id = auth.uid()
      limit 1;
    end if;
  end if;

  if v_class_name is null or btrim(v_class_name) = '' then
    if v_class_id is null then
      return array[]::uuid[];
    end if;
    return array[v_class_id];
  end if;

  select coalesce(array_agg(c.id), array[]::uuid[])
  into v_ids
  from public.classes c
  where lower(regexp_replace(c.name, '\s+', '', 'g')) =
        lower(regexp_replace(v_class_name, '\s+', '', 'g'));

  if v_class_id is not null and not (v_class_id = any(v_ids)) then
    v_ids := array_append(v_ids, v_class_id);
  end if;

  return coalesce(v_ids, array[]::uuid[]);
end;
$$;

grant execute on function public.current_user_class_ids() to authenticated;

create or replace function public.current_user_class_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select (public.current_user_class_ids())[1];
$$;

grant execute on function public.current_user_class_id() to authenticated;

alter table if exists public.live_sessions enable row level security;

drop policy if exists "live_sessions_select_teacher_or_student_scope" on public.live_sessions;
create policy "live_sessions_select_teacher_or_student_scope"
on public.live_sessions
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  or (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
    )
    and (
      target_scope = 'all'
      or class_id = any(public.current_user_class_ids())
    )
  )
);

-- Live polls (low-cost engagement: one vote per student)
create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  question text not null check (char_length(trim(question)) > 0 and char_length(question) <= 220),
  options text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'closed')),
  expires_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward compatibility: if table already existed with partial columns.
alter table if exists public.live_polls
  add column if not exists live_session_id uuid references public.live_sessions(id) on delete cascade,
  add column if not exists question text,
  add column if not exists options text[] default '{}'::text[],
  add column if not exists status text default 'active',
  add column if not exists expires_at timestamptz null,
  add column if not exists created_by uuid references auth.users(id) on delete cascade default auth.uid(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.live_polls
set
  question = coalesce(nullif(trim(question), ''), 'Poll'),
  options = case
    when options is null or array_length(options, 1) is null then array['Option 1', 'Option 2']::text[]
    else options
  end,
  status = case
    when lower(coalesce(status, '')) = 'closed' then 'closed'
    else 'active'
  end
where question is null
   or options is null
   or array_length(options, 1) is null
   or status is null;

alter table if exists public.live_polls
  alter column question set default 'Poll',
  alter column options set default '{}'::text[],
  alter column status set default 'active',
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_polls_status_check'
      and conrelid = 'public.live_polls'::regclass
  ) then
    alter table public.live_polls
      add constraint live_polls_status_check
      check (status in ('active', 'closed'));
  end if;
end;
$$;

create index if not exists live_polls_session_status_idx
  on public.live_polls(live_session_id, status, created_at desc);
drop index if exists live_polls_session_active_ux;
create unique index if not exists live_polls_session_active_ux
  on public.live_polls(live_session_id)
  where status = 'active';

create or replace function public.touch_live_polls_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_live_polls_updated_at on public.live_polls;
create trigger trg_touch_live_polls_updated_at
before update on public.live_polls
for each row execute function public.touch_live_polls_updated_at();

create table if not exists public.live_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.live_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  option_index int not null check (option_index >= 0 and option_index <= 3),
  created_at timestamptz not null default now()
);

alter table if exists public.live_poll_votes
  add column if not exists poll_id uuid references public.live_polls(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  add column if not exists option_index int,
  add column if not exists created_at timestamptz default now();

update public.live_poll_votes
set option_index = 0
where option_index is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_poll_votes_option_index_check'
      and conrelid = 'public.live_poll_votes'::regclass
  ) then
    alter table public.live_poll_votes
      add constraint live_poll_votes_option_index_check
      check (option_index >= 0 and option_index <= 3);
  end if;
end;
$$;

create unique index if not exists live_poll_votes_poll_user_ux
  on public.live_poll_votes(poll_id, user_id);
create index if not exists live_poll_votes_poll_idx
  on public.live_poll_votes(poll_id, option_index);

alter table public.live_polls enable row level security;
alter table public.live_poll_votes enable row level security;

drop policy if exists "live_polls_select_scope" on public.live_polls;
create policy "live_polls_select_scope"
on public.live_polls
for select
to authenticated
using (
  exists (
    select 1
    from public.live_sessions ls
    where ls.id = live_session_id
      and (
        public.is_teacher()
        or ls.target_scope = 'all'
        or ls.class_id = any(public.current_user_class_ids())
      )
  )
);

drop policy if exists "live_polls_teacher_insert" on public.live_polls;
create policy "live_polls_teacher_insert"
on public.live_polls
for insert
to authenticated
with check (
  public.is_teacher()
  and auth.uid() = created_by
);

drop policy if exists "live_polls_teacher_update" on public.live_polls;
create policy "live_polls_teacher_update"
on public.live_polls
for update
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists "live_polls_teacher_delete" on public.live_polls;
create policy "live_polls_teacher_delete"
on public.live_polls
for delete
to authenticated
using (public.is_teacher());

drop policy if exists "live_poll_votes_select_scope" on public.live_poll_votes;
create policy "live_poll_votes_select_scope"
on public.live_poll_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.live_polls p
    join public.live_sessions ls on ls.id = p.live_session_id
    where p.id = poll_id
      and (
        public.is_teacher()
        or ls.target_scope = 'all'
        or ls.class_id = any(public.current_user_class_ids())
      )
  )
);

drop policy if exists "live_poll_votes_insert_scope" on public.live_poll_votes;
create policy "live_poll_votes_insert_scope"
on public.live_poll_votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_polls p
    join public.live_sessions ls on ls.id = p.live_session_id
    where p.id = poll_id
      and p.status = 'active'
      and (p.expires_at is null or p.expires_at > now())
      and (
        public.is_teacher()
        or ls.target_scope = 'all'
        or ls.class_id = any(public.current_user_class_ids())
      )
  )
);

drop policy if exists "live_poll_votes_update_own" on public.live_poll_votes;
create policy "live_poll_votes_update_own"
on public.live_poll_votes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Runtime app copy + support links (editable without app update)
create table if not exists public.app_runtime_config (
  id int primary key,
  lock_title text not null default 'Verification Pending',
  lock_message text not null default 'Please contact staff for activation.',
  support_phone text not null default '8002271522',
  support_whatsapp_text text not null default 'Namaste LKD Team, mera account verification pending hai. Kripya activation help karein.',
  app_access_fee numeric(10,2) not null default 50,
  payment_notice_enabled boolean not null default false,
  payment_notice_url text null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_app_runtime_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_runtime_config_updated_at on public.app_runtime_config;
create trigger trg_touch_app_runtime_config_updated_at
before update on public.app_runtime_config
for each row execute function public.touch_app_runtime_config_updated_at();

insert into public.app_runtime_config (
  id,
  lock_title,
  lock_message,
  support_phone,
  support_whatsapp_text,
  app_access_fee,
  payment_notice_enabled,
  payment_notice_url
)
values (
  1,
  'Verification Pending',
  'Please contact staff on WhatsApp for account activation.',
  '8002271522',
  'Namaste LKD Team, mera account verification pending hai. Kripya activation help karein.',
  50,
  false,
  null
)
on conflict (id) do update
set
  lock_title = excluded.lock_title,
  lock_message = excluded.lock_message,
  support_phone = excluded.support_phone,
  support_whatsapp_text = excluded.support_whatsapp_text,
  app_access_fee,
  payment_notice_enabled = excluded.payment_notice_enabled,
  payment_notice_url = excluded.payment_notice_url,
  updated_at = now();

alter table public.app_runtime_config enable row level security;

drop policy if exists "app_runtime_config_public_read" on public.app_runtime_config;
create policy "app_runtime_config_public_read"
on public.app_runtime_config
for select
to anon, authenticated
using (id = 1);

drop policy if exists "app_runtime_config_teacher_manage" on public.app_runtime_config;
create policy "app_runtime_config_teacher_manage"
on public.app_runtime_config
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);



-- App access verification (server-side amount check + roll assignment)
create or replace function public.verify_app_access_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_fee numeric;
begin
  if p_payment_id is null then
    return false;
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
    and user_id = auth.uid()
  limit 1;

  if v_payment.id is null then
    return false;
  end if;

  if coalesce(v_payment.status, '') <> 'success' then
    return false;
  end if;

  if v_payment.provider_payment_id is null and coalesce(v_payment.provider, '') <> 'promo' then
    return false;
  end if;

  select app_access_fee
  into v_fee
  from public.app_runtime_config
  where id = 1
  limit 1;

  v_fee := coalesce(v_fee, 50);

  if coalesce(v_payment.amount, 0) < v_fee then
    return false;
  end if;

  update public.profiles
  set app_access_paid = true
  where id = auth.uid();

  update public.students
  set app_access_paid = true
  where user_id = auth.uid();

  perform public.assign_roll_for_user(auth.uid());

  return true;
end;
$$;

grant execute on function public.verify_app_access_payment(uuid) to authenticated;

-- Payments flow metadata (for in-app Razorpay + promo routing)
alter table if exists public.payments
  add column if not exists flow text,
  add column if not exists metadata jsonb,
  add column if not exists promo_code text;

update public.payments
set flow = coalesce(flow, metadata ->> 'flow')
where flow is null
  and metadata ? 'flow';

create or replace function public.ensure_payment_flow_from_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.flow is null and new.metadata ? 'flow' then
    new.flow := new.metadata ->> 'flow';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payments_flow_from_metadata on public.payments;
create trigger trg_payments_flow_from_metadata
before insert or update on public.payments
for each row execute function public.ensure_payment_flow_from_metadata();

-- Mock test attempt grouping (for answer review)
alter table if exists public.mock_test_attempts
  add column if not exists attempt_id uuid;

alter table if exists public.mock_test_results
  add column if not exists attempt_id uuid;

create index if not exists mock_test_attempts_attempt_id_idx
  on public.mock_test_attempts(attempt_id);

-- Mock test attempts: allow students to upsert their own answers
alter table if exists public.mock_test_attempts enable row level security;

drop policy if exists "mock_test_attempts_select_own" on public.mock_test_attempts;
create policy "mock_test_attempts_select_own"
on public.mock_test_attempts
for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "mock_test_attempts_insert_own" on public.mock_test_attempts;
create policy "mock_test_attempts_insert_own"
on public.mock_test_attempts
for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists "mock_test_attempts_update_own" on public.mock_test_attempts;
create policy "mock_test_attempts_update_own"
on public.mock_test_attempts
for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

-- Mock test results: allow students to write their own result
alter table if exists public.mock_test_results enable row level security;

drop policy if exists "mock_test_results_select_own" on public.mock_test_results;
create policy "mock_test_results_select_own"
on public.mock_test_results
for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "mock_test_results_insert_own" on public.mock_test_results;
create policy "mock_test_results_insert_own"
on public.mock_test_results
for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists "mock_test_results_update_own" on public.mock_test_results;
create policy "mock_test_results_update_own"
on public.mock_test_results
for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);
