-- Parent links are bearer credentials: only a SHA-256 digest is retained.
create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 3 and 5000),
  due_at timestamptz not null,
  status text not null default 'published' check (status in ('published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  answer text not null default '' check (char_length(answer) <= 5000),
  file_path text,
  file_name text,
  status text not null default 'submitted' check (status in ('submitted','revision_requested','reviewed')),
  feedback text check (char_length(feedback) <= 3000),
  score numeric(5,2) check (score between 0 and 100),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (char_length(btrim(answer)) > 0 or file_path is not null)
);
create table public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  learning_mode text not null check (learning_mode in ('offline','online','hybrid')),
  location text check (char_length(location) <= 300),
  status text not null default 'open' check (status in ('open','booked','cancelled')),
  schedule_id uuid references public.schedules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at + interval '15 minutes' and end_at <= start_at + interval '4 hours')
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid,
  source text not null,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  order_id text not null unique,
  amount numeric(12,0) not null check (amount > 0),
  status text not null default 'creating' check (status in ('creating','pending','paid','failed','expired','refund','partial_refund','chargeback')),
  redirect_url text,
  provider_status text,
  payment_id uuid references public.payments(id) on delete set null,
  expires_at timestamptz not null default now() + interval '1 hour',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_orders_one_pending on public.payment_orders(invoice_id) where status in ('creating','pending');
create index portal_links_user on public.portal_links(user_id);
create index assignments_student_due on public.assignments(user_id,student_id,due_at);
create index assignments_session on public.assignments(session_id);
create index homework_submissions_user on public.homework_submissions(user_id,student_id);
create index booking_slots_user_time on public.booking_slots(user_id,start_at,end_at) where status = 'open';
create index booking_slots_subject on public.booking_slots(subject_id);
create index booking_slots_schedule on public.booking_slots(schedule_id);
create index audit_logs_user_created on public.audit_logs(user_id,created_at desc,id);
create index audit_logs_record on public.audit_logs(user_id,table_name,record_id,created_at desc);
create index payment_orders_user on public.payment_orders(user_id,student_id);
create index payment_orders_payment on public.payment_orders(payment_id);

do $$ declare t text; begin
  foreach t in array array['portal_links','assignments','homework_submissions','booking_slots','audit_logs','payment_orders'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_read on public.%I for select to authenticated using (user_id = (select auth.uid()))',t);
  end loop;
  foreach t in array array['assignments','booking_slots'] loop
    execute format('grant insert,update on public.%I to authenticated',t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
  end loop;
  grant update(status,feedback,score,reviewed_at) on public.homework_submissions to authenticated;
  create policy own_review on public.homework_submissions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
end $$;

create or replace function private.validate_learning_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name in ('assignments','homework_submissions') then
    if not exists(select 1 from public.students where id=new.student_id and user_id=new.user_id and deleted_at is null) then
      raise exception 'Murid tidak tersedia' using errcode='P0001';
    end if;
    if tg_table_name='assignments' then
    if new.session_id is not null and not exists(
      select 1 from public.sessions where id=new.session_id and user_id=new.user_id and student_id=new.student_id
    ) then raise exception 'Pertemuan tidak sesuai murid' using errcode='P0001'; end if;
    end if;
    if tg_table_name='homework_submissions' then
    if not exists(
      select 1 from public.assignments where id=new.assignment_id and user_id=new.user_id and student_id=new.student_id
    ) then raise exception 'Tugas tidak sesuai murid' using errcode='P0001'; end if;
    end if;
  else
    if new.schedule_id is not null and not exists(select 1 from public.schedules where id=new.schedule_id and user_id=new.user_id) then
      raise exception 'Jadwal tidak sesuai pemilik slot' using errcode='P0001'; end if;
    if not exists(select 1 from public.subjects where id=new.subject_id and user_id=new.user_id) then
      raise exception 'Mata pelajaran tidak tersedia' using errcode='P0001';
    end if;
    if new.status='open' then
      perform pg_advisory_xact_lock(hashtextextended('schedule:'||new.user_id::text,0));
      if new.start_at <= now() or exists(select 1 from public.booking_slots b where b.user_id=new.user_id and b.id<>new.id
        and b.status='open' and b.start_at<new.end_at and b.end_at>new.start_at) or exists(
        select 1 from public.schedules s where s.user_id=new.user_id and s.status='scheduled' and s.start_at<new.end_at and s.end_at>new.start_at
      ) then raise exception 'Slot bentrok dengan jadwal lain atau sudah lewat' using errcode='P0001'; end if;
    end if;
  end if;
  new.updated_at=now(); return new;
end $$;
create trigger assignment_owner before insert or update on public.assignments for each row execute function private.validate_learning_owner();
create trigger submission_owner before insert or update on public.homework_submissions for each row execute function private.validate_learning_owner();
create trigger slot_owner before insert or update on public.booking_slots for each row execute function private.validate_learning_owner();

-- All schedule writers share this lock, including existing teacher actions.
create or replace function private.check_schedule_conflict() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='scheduled' and (tg_op='INSERT' or new.start_at is distinct from old.start_at
    or new.end_at is distinct from old.end_at or new.status is distinct from old.status) then
    perform pg_advisory_xact_lock(hashtextextended('schedule:'||new.user_id::text,0));
    if exists(select 1 from public.schedules s where s.user_id=new.user_id and s.id<>new.id
      and s.status='scheduled' and s.start_at<new.end_at and s.end_at>new.start_at) then
      raise exception 'Jadwal bentrok dengan pertemuan lain' using errcode='P0001';
    end if;
    update public.booking_slots set status='cancelled' where user_id=new.user_id and status='open' and start_at<new.end_at and end_at>new.start_at;
  end if;
  return new;
end $$;
create trigger schedule_conflict before insert or update on public.schedules for each row execute function private.check_schedule_conflict();

create or replace function public.rotate_portal_link(p_student_id uuid,p_hash text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.students where id=p_student_id and user_id=(select auth.uid()) and deleted_at is null) then
    raise exception 'Murid tidak ditemukan' using errcode='P0001'; end if;
  insert into public.portal_links(user_id,student_id,token_hash,expires_at)
    values(auth.uid(),p_student_id,p_hash,now()+interval '90 days')
    on conflict(student_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked_at=null,created_at=now();
end $$;
-- This table permits teacher rotation/revocation but is never exposed to guests.
grant insert,update on public.portal_links to authenticated;
create policy portal_insert on public.portal_links for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.students s where s.id=student_id and s.user_id=(select auth.uid())));
create policy portal_update on public.portal_links for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.students s where s.id=student_id and s.user_id=(select auth.uid())));

create or replace function private.portal_student(p_hash text) returns public.students
language sql stable security definer set search_path='' as $$
  select s.* from public.portal_links l join public.students s on s.id=l.student_id and s.user_id=l.user_id
  where l.token_hash=p_hash and l.revoked_at is null and l.expires_at>now() and s.deleted_at is null and s.status='active'
$$;
create or replace function public.portal_book_slot(p_hash text,p_slot_id uuid,p_schedule_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_student public.students; v_slot public.booking_slots; v_old public.schedules; v_id uuid;
begin
  v_student=private.portal_student(p_hash);
  if v_student.id is null then raise exception 'Akses portal kedaluwarsa atau dinonaktifkan' using errcode='P0001'; end if;
  perform set_config('app.change_source','Portal',true);
  perform pg_advisory_xact_lock(hashtextextended('schedule:'||v_student.user_id::text,0));
  select * into v_slot from public.booking_slots where id=p_slot_id and user_id=v_student.user_id and status='open' and start_at>now()+interval '2 hours' for update;
  if v_slot.id is null then raise exception 'Slot tidak tersedia. Pilih jadwal lain' using errcode='P0001'; end if;
  if not exists(select 1 from public.student_subjects where student_id=v_student.id and user_id=v_student.user_id and subject_id=v_slot.subject_id) then
    raise exception 'Mata pelajaran belum terdaftar untuk murid ini' using errcode='P0001'; end if;
  if p_schedule_id is not null then
    select * into v_old from public.schedules where id=p_schedule_id and user_id=v_student.user_id and student_id=v_student.id and status='scheduled' and start_at>now()+interval '24 hours' for update;
    if v_old.id is null then raise exception 'Perubahan jadwal harus lebih dari 24 jam sebelum pertemuan' using errcode='P0001'; end if;
    if v_old.subject_id<>v_slot.subject_id or (v_old.end_at-v_old.start_at)<>(v_slot.end_at-v_slot.start_at) then
      raise exception 'Pilih mata pelajaran dan durasi yang sama' using errcode='P0001'; end if;
    update public.schedules set start_at=v_slot.start_at,end_at=v_slot.end_at,learning_mode=v_slot.learning_mode,location=v_slot.location where id=v_old.id;
    v_id=v_old.id;
    update public.booking_slots set status='cancelled' where schedule_id=v_id and status='booked';
  else
    if v_student.billing_type='package' and not exists(
      select 1 from public.student_packages p where p.student_id=v_student.id and p.user_id=v_student.user_id and p.status='active'
      and p.total_sessions-p.sessions_used > (select count(*) from public.schedules where student_id=v_student.id and user_id=v_student.user_id and status='scheduled')
    ) then raise exception 'Sisa paket sudah terjadwal. Hubungi guru untuk menambah pertemuan' using errcode='P0001'; end if;
    insert into public.schedules(user_id,student_id,subject_id,start_at,end_at,learning_mode,location)
      values(v_student.user_id,v_student.id,v_slot.subject_id,v_slot.start_at,v_slot.end_at,v_slot.learning_mode,v_slot.location) returning id into v_id;
  end if;
  update public.booking_slots set status='booked',schedule_id=v_id where id=v_slot.id;
  insert into public.notifications(user_id,type,ref_key,title,body,link)
    values(v_student.user_id,'info','booking:'||gen_random_uuid()::text,
      case when p_schedule_id is null then 'Booking baru' else 'Perubahan jadwal' end,
      v_student.full_name||' · '||to_char(v_slot.start_at at time zone 'Asia/Jakarta','DD Mon HH24:MI')||' WIB','/dashboard');
  return v_id;
end $$;
create or replace function public.portal_submit_homework(p_hash text,p_assignment_id uuid,p_answer text,p_file_path text,p_file_name text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.students; a public.assignments;
begin
  s=private.portal_student(p_hash);
  if s.id is null then raise exception 'Akses portal tidak tersedia' using errcode='P0001'; end if;
  perform set_config('app.change_source','Portal',true);
  select * into a from public.assignments where id=p_assignment_id and student_id=s.id and user_id=s.user_id and status='published' for update;
  if a.id is null then raise exception 'Tugas sudah ditutup atau tidak tersedia' using errcode='P0001'; end if;
  if p_file_path is not null and p_file_path not like s.user_id::text||'/'||s.id::text||'/'||a.id::text||'/%' then
    raise exception 'Berkas tidak sesuai tugas' using errcode='P0001'; end if;
  insert into public.homework_submissions(user_id,student_id,assignment_id,answer,file_path,file_name)
    values(s.user_id,s.id,a.id,btrim(p_answer),p_file_path,p_file_name)
    on conflict(assignment_id) do update set answer=excluded.answer,file_path=excluded.file_path,file_name=excluded.file_name,
      status='submitted',score=null,reviewed_at=null,submitted_at=now();
  insert into public.notifications(user_id,type,ref_key,title,body,link)
    values(s.user_id,'info','homework:'||a.id::text,'PR dikumpulkan',s.full_name||' · '||a.title,'/homework')
    on conflict(user_id,ref_key) do update set read_at=null,body=excluded.body,created_at=now();
end $$;

create or replace function public.portal_invoice_balances(p_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from (
    select inv.id,inv.invoice_number,inv.period_label,inv.amount,inv.due_date,inv.status,
      coalesce((select sum(p.amount) from public.payments p where p.invoice_id=inv.id and p.user_id=inv.user_id),0) paid_total,
      exists(select 1 from public.payment_orders o where o.invoice_id=inv.id and o.user_id=inv.user_id) has_order
    from public.invoices inv join private.portal_student(p_hash) s on s.id=inv.student_id and s.user_id=inv.user_id
    order by inv.created_at desc limit 100
  ) i
$$;
create or replace function public.reschedule_teacher(p_schedule_id uuid,p_start_at timestamptz,p_end_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid=auth.uid();
begin
  if u is null then raise exception 'Silakan masuk kembali' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('schedule:'||u::text,0));
  update public.schedules set start_at=p_start_at,end_at=p_end_at where id=p_schedule_id and user_id=u and status='scheduled';
  if not found then raise exception 'Jadwal tidak tersedia' using errcode='P0001'; end if;
end $$;

create or replace function private.capture_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; v jsonb;
begin
  if tg_op<>'INSERT' then b=to_jsonb(old); end if;
  if tg_op<>'DELETE' then a=to_jsonb(new); end if;
  if tg_op='UPDATE' and (b-'updated_at')=(a-'updated_at') then return new; end if;
  v=coalesce(a,b);
  -- A profile cascade represents account erasure, not a recoverable edit.
  if exists(select 1 from public.profiles where id=(v->>'user_id')::uuid) then
    insert into public.audit_logs(user_id,actor_id,source,table_name,record_id,operation,before_data,after_data)
      values((v->>'user_id')::uuid,auth.uid(),coalesce(nullif(current_setting('app.change_source',true),''),'guru'),tg_table_name,(v->>'id')::uuid,tg_op,b,a);
  end if;
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['students','schedules','sessions','attendance','invoices','payments','student_packages','expenses','assignments','homework_submissions','booking_slots','payment_orders'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.capture_audit()',t);
  end loop;
end $$;
create or replace function public.archive_student(p_student_id uuid,p_restore boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare s public.students;
begin
  select * into s from public.students where id=p_student_id and user_id=auth.uid() for update;
  if s.id is null then raise exception 'Murid tidak ditemukan' using errcode='P0001'; end if;
  if p_restore then
    if s.deleted_at is null then raise exception 'Murid sudah dipulihkan' using errcode='P0001'; end if;
    update public.students set deleted_at=null,status='inactive' where id=s.id;
  else
    if s.deleted_at is not null then raise exception 'Murid sudah diarsipkan' using errcode='P0001'; end if;
    update public.students set deleted_at=now(),status='inactive' where id=s.id;
    update public.schedules set status='cancelled' where student_id=s.id and user_id=s.user_id and status='scheduled';
    update public.portal_links set revoked_at=now() where student_id=s.id and user_id=s.user_id;
  end if;
end $$;
create or replace function public.restore_session_revision(p_log_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare l public.audit_logs; s public.sessions;
begin
  select * into l from public.audit_logs where id=p_log_id and user_id=auth.uid() and table_name='sessions' and operation='UPDATE';
  if l.id is null then raise exception 'Versi tidak tersedia' using errcode='P0001'; end if;
  select * into s from public.sessions where id=l.record_id and user_id=auth.uid() for update;
  if s.id is null or (to_jsonb(s)-'updated_at')<>(l.after_data-'updated_at') then
    raise exception 'Data sudah berubah. Muat ulang riwayat dan pilih perubahan terbaru' using errcode='P0001'; end if;
  update public.sessions set material=l.before_data->>'material',sub_material=l.before_data->>'sub_material',
    learning_notes=l.before_data->>'learning_notes',homework=l.before_data->>'homework',
    progress_notes=l.before_data->>'progress_notes',score=(l.before_data->>'score')::numeric where id=s.id;
end $$;

-- Online orders reserve the balance atomically; manual writers cannot double charge it.
create or replace function public.reserve_midtrans_order(p_invoice_id uuid,p_order_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.invoices; o public.payment_orders; total numeric;
begin
  select * into i from public.invoices where id=p_invoice_id for update;
  if i.id is null or not exists(select 1 from public.students where id=i.student_id and user_id=i.user_id and deleted_at is null) then raise exception 'Tagihan tidak tersedia' using errcode='P0001'; end if;
  select * into o from public.payment_orders where invoice_id=i.id and status in ('creating','pending');
  if o.id is not null then return to_jsonb(o); end if;
  select coalesce(sum(amount),0) into total from public.payments where invoice_id=i.id;
  if i.amount-total<=0 then raise exception 'Tagihan sudah lunas' using errcode='P0001'; end if;
  insert into public.payment_orders(user_id,student_id,invoice_id,order_id,amount)
    values(i.user_id,i.student_id,i.id,p_order_id,i.amount-total) returning * into o;
  return to_jsonb(o);
end $$;
create or replace function private.protect_pending_payment() returns trigger
language plpgsql security definer set search_path='' as $$
declare inv uuid;
begin
  if tg_table_name='payments' then
    inv=new.invoice_id;
    perform 1 from public.invoices where id=inv for update;
    if inv is not null and not exists(select 1 from public.invoices where id=inv and user_id=new.user_id and student_id=new.student_id) then
      raise exception 'Tagihan tidak sesuai murid atau pemilik' using errcode='P0001'; end if;
  else
    inv=old.id;
    if tg_op='UPDATE' and new.amount=old.amount then return new; end if;
  end if;
  if exists(select 1 from public.payment_orders where invoice_id=inv and status in ('creating','pending')) then
    raise exception 'Pembayaran online masih berlangsung. Periksa statusnya dahulu' using errcode='P0001'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_online_payment before insert on public.payments for each row execute function private.protect_pending_payment();
create trigger protect_online_invoice before update or delete on public.invoices for each row execute function private.protect_pending_payment();
create or replace function public.apply_midtrans_status(p_order_id text,p_amount numeric,p_status text,p_method text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; i public.invoices; total numeric; v_payment uuid;
begin
  -- Lock invoice first, matching manual payments/reservations and avoiding deadlocks.
  select i2.* into i from public.invoices i2 join public.payment_orders o2 on o2.invoice_id=i2.id where o2.order_id=p_order_id for update of i2;
  select * into o from public.payment_orders where order_id=p_order_id for update;
  if o.id is null then raise exception 'Transaksi tidak ditemukan' using errcode='P0001'; end if;
  if p_amount<>o.amount then raise exception 'Nominal transaksi tidak sesuai' using errcode='P0001'; end if;
  perform set_config('app.change_source','Midtrans',true);
  if p_status in ('refund','partial_refund','chargeback','partial_chargeback') then
    update public.payment_orders set status=case when p_status='partial_chargeback' then 'chargeback' else p_status end,provider_status=p_status,updated_at=now() where id=o.id;
    insert into public.notifications(user_id,type,ref_key,title,body,link) values(o.user_id,'info','payment-refund:'||o.id::text,
      'Pembayaran perlu rekonsiliasi',i.invoice_number||' · '||p_status,'/invoices/'||i.id::text) on conflict(user_id,ref_key) do nothing;
    return;
  end if;
  if o.payment_id is not null then return; end if;
  if p_status='paid' then
    update public.payment_orders set status='paid',provider_status=p_status,updated_at=now() where id=o.id;
    select coalesce(sum(amount),0) into total from public.payments where invoice_id=i.id;
    if total+o.amount>i.amount then raise exception 'Pembayaran melebihi tagihan; perlu rekonsiliasi' using errcode='P0001'; end if;
    insert into public.payments(user_id,student_id,invoice_id,type,amount,payment_date,method,notes)
      values(o.user_id,o.student_id,o.invoice_id,i.type,o.amount,(now() at time zone 'Asia/Jakarta')::date,
        case when p_method in ('gopay','shopeepay','qris','dana','ovo') then 'ewallet' when p_method in ('bank_transfer','echannel','permata','bca','bni','bri') then 'bank_transfer' else 'other' end,
        'Midtrans · '||o.order_id) returning id into v_payment;
    update public.payment_orders set payment_id=v_payment where id=o.id;
    update public.invoices set status=case when total+o.amount>=amount then 'paid' else 'partial' end where id=i.id;
    insert into public.notifications(user_id,type,ref_key,title,body,link) values(o.user_id,'info','payment-paid:'||o.id::text,
      'Pembayaran diterima',i.invoice_number,'/invoices/'||i.id::text) on conflict(user_id,ref_key) do nothing;
  elsif p_status in ('failed','expired') then
    update public.payment_orders set status=p_status,provider_status=p_status,updated_at=now() where id=o.id;
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('homework','homework',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy homework_teacher_read on storage.objects for select to authenticated
  using(bucket_id='homework' and (storage.foldername(name))[1]=(select auth.uid())::text);

revoke all on function public.rotate_portal_link(uuid,text),public.archive_student(uuid,boolean),public.restore_session_revision(uuid) from public,anon;
grant execute on function public.rotate_portal_link(uuid,text),public.archive_student(uuid,boolean),public.restore_session_revision(uuid) to authenticated;
revoke all on function public.portal_book_slot(text,uuid,uuid),public.portal_submit_homework(text,uuid,text,text,text),public.reserve_midtrans_order(uuid,text),public.apply_midtrans_status(text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.portal_book_slot(text,uuid,uuid),public.portal_submit_homework(text,uuid,text,text,text),public.reserve_midtrans_order(uuid,text),public.apply_midtrans_status(text,numeric,text,text) to service_role;
revoke all on function private.validate_learning_owner(),private.check_schedule_conflict(),private.portal_student(text),private.capture_audit(),private.protect_pending_payment() from public,anon,authenticated;
revoke all on function public.portal_invoice_balances(text) from public,anon,authenticated;
grant execute on function public.portal_invoice_balances(text) to service_role;
revoke all on function public.reschedule_teacher(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.reschedule_teacher(uuid,timestamptz,timestamptz) to authenticated;
