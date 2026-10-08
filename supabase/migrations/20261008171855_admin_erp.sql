-- Platform administration is isolated from each teacher's teaching/business data.
create table private.admin_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','support')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table private.account_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended')),
  reason text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index account_controls_actor_idx on private.account_controls(updated_by);
create table private.account_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create table private.review_followups (
  review_id uuid primary key references public.app_reviews(id) on delete cascade,
  status text not null default 'new' check (status in ('new','read','resolved')),
  note text not null default '',
  handled_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index review_followups_actor_idx on private.review_followups(handled_by);
create table private.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 5 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  category text not null check (category in ('bug','account','suggestion','other')),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  reply text not null default '',
  internal_note text not null default '',
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on private.support_tickets(user_id,created_at desc);
create index support_tickets_queue_idx on private.support_tickets(status,created_at desc);
create index support_tickets_actor_idx on private.support_tickets(handled_by);
create table private.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 120),
  body text not null check (char_length(body) between 10 and 4000),
  status text not null default 'draft' check (status in ('draft','scheduled','published','cancelled')),
  target_users uuid[],
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);
create index announcements_due_idx on private.announcements(publish_at) where status='scheduled';
create index announcements_actor_idx on private.announcements(created_by);
create table private.service_runs (
  id bigint generated always as identity primary key,
  service text not null check (service in ('send-push','announcements')),
  outcome text not null check (outcome in ('ok','error')),
  processed integer not null default 0 check (processed>=0),
  sent integer not null default 0 check (sent>=0),
  failed integer not null default 0 check (failed>=0),
  duration_ms integer not null default 0 check (duration_ms>=0),
  message text not null default '',
  created_at timestamptz not null default now()
);
create index service_runs_recent_idx on private.service_runs(service,created_at desc);
create table private.website_settings (
  id boolean primary key default true check (id),
  site_name text not null default 'MudahMengajar' check (char_length(site_name) between 3 and 60),
  support_email text not null default '',
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.website_settings(id) values(true);
create table private.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null check (category in ('hosting','domain','tools','other')),
  description text not null check (char_length(description) between 3 and 200),
  amount numeric(12,0) not null check (amount>0),
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index platform_expenses_date_idx on private.platform_expenses(expense_date desc) where archived_at is null;
create index platform_expenses_actor_idx on private.platform_expenses(created_by);
create table private.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_recent_idx on private.admin_audit(created_at desc);
create index admin_audit_actor_idx on private.admin_audit(actor_id);

-- No direct access to administration tables, including for an authenticated owner.
do $$ declare t text; begin
  foreach t in array array['admin_members','account_controls','account_activity','review_followups',
    'support_tickets','announcements','service_runs','website_settings','platform_expenses','admin_audit'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
  end loop;
end $$;

create function private.account_enabled(p_uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select p_uid is not null and not exists (
    select 1 from private.account_controls where user_id=p_uid and status='suspended');
$$;
create function private.app_accessible(p_uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.account_enabled(p_uid) and (
    not (select maintenance_mode from private.website_settings where id)
    or exists(select 1 from private.admin_members where user_id=p_uid and active));
$$;
create function private.current_admin_role() returns text
language sql stable security definer set search_path='' as $$
  select role from private.admin_members
  where user_id=auth.uid() and active and private.account_enabled(auth.uid());
$$;
create function private.admin_mfa_verified() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.jwt()->>'aal'='aal2' and exists (
    select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
      and s.aal='aal2' and (s.not_after is null or s.not_after>now()));
$$;
create function private.require_admin(p_owner boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_role text := private.current_admin_role(); begin
  if v_role is null or (p_owner and v_role<>'owner') then
    raise exception 'Anda tidak memiliki akses admin.' using errcode='42501';
  end if;
  if not coalesce(private.admin_mfa_verified(),false) then
    raise exception 'Verifikasi dua langkah diperlukan.' using errcode='42501';
  end if;
  return auth.uid();
end $$;
create function private.admin_access() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('role',private.current_admin_role(),
    'verified',coalesce(private.admin_mfa_verified(),false));
$$;
create function public.get_admin_access() returns jsonb language sql security invoker set search_path='' as $$
  select private.admin_access();
$$;
create function private.account_access() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_status text; v_reason text; begin
  if v_uid is null then raise exception 'Tidak terautentikasi.'; end if;
  select status,reason into v_status,v_reason from private.account_controls where user_id=v_uid;
  if coalesce(v_status,'active')='active' then
    insert into private.account_activity(user_id) values(v_uid) on conflict(user_id)
    do update set last_seen_at=now() where private.account_activity.last_seen_at<now()-interval '5 minutes';
  end if;
  return jsonb_build_object('status',coalesce(v_status,'active'),'reason',coalesce(v_reason,''),
    'role',private.current_admin_role(),'maintenance',(select maintenance_mode from private.website_settings where id));
end $$;
create function public.get_account_access() returns jsonb language sql security invoker set search_path='' as $$
  select private.account_access();
$$;
create function private.site_config() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('site_name',site_name,'support_email',support_email,'maintenance_mode',maintenance_mode)
  from private.website_settings where id;
$$;
create function public.get_site_config() returns jsonb language sql security invoker set search_path='' as $$
  select private.site_config();
$$;
create function public.is_account_enabled(p_user_id uuid) returns boolean
language sql security invoker set search_path='' as $$ select private.app_accessible(p_user_id); $$;

-- Restrictive policies combine with existing ownership policies; administrators
-- do not acquire cross-teacher table access. Privileged access uses guarded DTO RPCs.
do $$ declare t record; begin
  for t in select table_name from information_schema.columns where table_schema='public'
    and column_name='user_id' and table_name not in ('schema_migrations')
    and exists(select 1 from pg_tables p where p.schemaname='public' and p.tablename=table_name) loop
    execute format('create policy account_active_guard on public.%I as restrictive for all to authenticated using ((select private.app_accessible(auth.uid()))) with check ((select private.app_accessible(auth.uid())))',t.table_name);
  end loop;
  create policy account_active_guard on public.profiles as restrictive for all to authenticated
    using ((select private.app_accessible(auth.uid()))) with check ((select private.app_accessible(auth.uid())));
  create policy account_active_guard on storage.objects as restrictive for all to authenticated
    using ((select private.app_accessible(auth.uid()))) with check ((select private.app_accessible(auth.uid())));
end $$;

-- Existing SECURITY DEFINER teacher RPCs must also reject suspended sessions.
do $$ declare f record; v_def text; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('complete_session','record_payment','create_package',
      'create_invoice','generate_monthly_invoices','generate_schedule_occurrences','get_dashboard_stats','cancel_schedule','refresh_reminders') loop
    v_def := pg_get_functiondef(f.oid);
    v_def := regexp_replace(v_def,'\mbegin\M',E'begin\n  if auth.uid() is null or not private.app_accessible(auth.uid()) then raise exception ''Akun tidak dapat mengakses aplikasi.'' using errcode=''42501''; end if;', 'i');
    execute v_def;
  end loop;
  select pg_get_functiondef('public.refresh_reminders_for_user(uuid)'::regprocedure) into v_def;
  execute regexp_replace(v_def,'\mbegin\M',E'begin\n  if not private.app_accessible(p_uid) then return; end if;', 'i');
  select pg_get_functiondef('public.get_public_profile(text)'::regprocedure) into v_def;
  -- This RPC resolves a slug or UUID before reading the profile.
  execute replace(v_def,'if not found then', 'if not found or not private.app_accessible(v_profile.id) then');
end $$;

create function private.admin_read(p_section text,p_search text default '',p_status text default 'all',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.require_admin(); v_data jsonb; v_total bigint := 0;
  v_offset integer := (greatest(1,least(coalesce(p_page,1),100000))-1)*20;
  v_search text := '%'||left(coalesce(p_search,''),120)||'%';
begin
  if p_section in ('expenses','settings','audit') then perform private.require_admin(true); end if;
  case p_section
  when 'dashboard' then
    return jsonb_build_object(
      'teachers',(select count(*) from public.profiles),
      'new_accounts',(select count(*) from public.profiles where created_at>=now()-interval '30 days'),
      'active_accounts',(select count(*) from private.account_activity a where last_seen_at>=now()-interval '30 days' and private.account_enabled(a.user_id)),
      'suspended',(select count(*) from private.account_controls where status='suspended'),
      'review_average',(select coalesce(round(avg(rating),1),0) from public.app_reviews),
      'review_new',(select count(*) from public.app_reviews r left join private.review_followups f on f.review_id=r.id where coalesce(f.status,'new')='new'),
      'ticket_open',(select count(*) from private.support_tickets where status<>'resolved'),
      'service_last',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select distinct on(service) service,outcome,created_at,failed from private.service_runs order by service,created_at desc,id desc) x),
      'growth',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select d::date as day,count(p.id) as accounts from generate_series(current_date-29,current_date,'1 day') d left join public.profiles p on p.created_at>=d and p.created_at<d+interval '1 day' group by d order by d) x));
  when 'accounts' then
    select count(*) into v_total from public.profiles p join auth.users u on u.id=p.id left join private.account_controls c on c.user_id=p.id
      where (p.full_name ilike v_search or u.email ilike v_search) and (p_status='all' or coalesce(c.status,'active')=p_status);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (
      select p.id,p.full_name,u.email,p.business_name,p.onboarding_completed,p.created_at,
        u.email_confirmed_at is not null as email_verified,coalesce(c.status,'active') as status,coalesce(c.reason,'') as reason,
        a.last_seen_at,m.role as admin_role,m.active as admin_active,
        (select count(*) from public.students s where s.user_id=p.id and s.deleted_at is null) as student_count,
        (select count(*) from public.sessions s where s.user_id=p.id) as session_count
      from public.profiles p join auth.users u on u.id=p.id left join private.account_controls c on c.user_id=p.id
      left join private.account_activity a on a.user_id=p.id left join private.admin_members m on m.user_id=p.id
      where (p.full_name ilike v_search or u.email ilike v_search) and (p_status='all' or coalesce(c.status,'active')=p_status)
      order by p.created_at desc,p.id limit 20 offset v_offset) x;
  when 'reviews' then
    select count(*) into v_total from public.app_reviews r join public.profiles p on p.id=r.user_id left join private.review_followups f on f.review_id=r.id
      where (p.full_name ilike v_search or r.comment ilike v_search) and (p_status='all' or coalesce(f.status,'new')=p_status or r.rating::text=p_status);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (
      select r.id,r.user_id,p.full_name,r.rating,r.comment,r.created_at,r.updated_at,coalesce(f.status,'new') as status,coalesce(f.note,'') as note
      from public.app_reviews r join public.profiles p on p.id=r.user_id left join private.review_followups f on f.review_id=r.id
      where (p.full_name ilike v_search or r.comment ilike v_search) and (p_status='all' or coalesce(f.status,'new')=p_status or r.rating::text=p_status)
      order by r.updated_at desc,r.id limit 20 offset v_offset) x;
  when 'tickets' then
    select count(*) into v_total from private.support_tickets t join public.profiles p on p.id=t.user_id
      where (t.subject ilike v_search or p.full_name ilike v_search) and (p_status='all' or t.status=p_status);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (
      select t.*,p.full_name from private.support_tickets t join public.profiles p on p.id=t.user_id
      where (t.subject ilike v_search or p.full_name ilike v_search) and (p_status='all' or t.status=p_status)
      order by case t.priority when 'high' then 0 when 'normal' then 1 else 2 end,t.created_at desc,t.id limit 20 offset v_offset) x;
  when 'announcements' then
    select count(*) into v_total from private.announcements where title ilike v_search and (p_status='all' or status=p_status);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (select a.*,
      (select jsonb_agg(u.email order by u.email) from auth.users u where u.id=any(a.target_users)) target_emails
      from private.announcements a where title ilike v_search and (p_status='all' or status=p_status) order by created_at desc,id limit 20 offset v_offset) x;
  when 'services' then
    select count(*) into v_total from private.service_runs where p_status='all' or outcome=p_status;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (select * from private.service_runs where p_status='all' or outcome=p_status order by created_at desc,id desc limit 20 offset v_offset) x;
  when 'expenses' then
    select count(*) into v_total from private.platform_expenses where archived_at is null and description ilike v_search;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (select * from private.platform_expenses where archived_at is null and description ilike v_search order by expense_date desc,id limit 20 offset v_offset) x;
    return jsonb_build_object('items',v_data,'total',v_total,'page',greatest(coalesce(p_page,1),1),
      'year_total',(select coalesce(sum(amount),0) from private.platform_expenses where archived_at is null and extract(year from expense_date)=extract(year from current_date)),
      'month_total',(select coalesce(sum(amount),0) from private.platform_expenses where archived_at is null and date_trunc('month',expense_date)=date_trunc('month',current_date)));
  when 'settings' then
    return jsonb_build_object('config',(select to_jsonb(s) from private.website_settings s where id),
      'members',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'active',m.active,'full_name',p.full_name,'email',u.email)),'[]') from private.admin_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id));
  when 'audit' then
    select count(*) into v_total from private.admin_audit;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_data from (select a.*,p.full_name from private.admin_audit a left join public.profiles p on p.id=a.actor_id order by a.created_at desc,a.id desc limit 20 offset v_offset) x;
  when 'reports' then
    return jsonb_build_object('months',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select to_char(d,'YYYY-MM') as month,
      (select count(*) from public.profiles where created_at>=d and created_at<d+interval '1 month') as accounts,
      (select count(*) from public.app_reviews where created_at>=d and created_at<d+interval '1 month') as reviews,
      (select coalesce(round(avg(rating),1),0) from public.app_reviews where created_at>=d and created_at<d+interval '1 month') as rating,
      (select count(*) from private.support_tickets where created_at>=d and created_at<d+interval '1 month') as tickets,
      (select coalesce(sum(amount),0) from private.platform_expenses where archived_at is null and expense_date>=d::date and expense_date<(d+interval '1 month')::date and private.current_admin_role()='owner') as expense
      from generate_series(date_trunc('month',current_date)-interval '11 months',date_trunc('month',current_date),'1 month') d order by d) x));
  else raise exception 'Halaman admin tidak valid.';
  end case;
  return jsonb_build_object('items',v_data,'total',v_total,'page',greatest(coalesce(p_page,1),1));
end $$;
create function public.admin_read(p_section text,p_search text default '',p_status text default 'all',p_page integer default 1)
returns jsonb language sql security invoker set search_path='' as $$ select private.admin_read(p_section,p_search,p_status,p_page); $$;

create function private.admin_mutate(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.require_admin(); v_id uuid; v_status text; v_targets uuid[];
begin
  if p_action not in ('review','ticket') then perform private.require_admin(true); end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Input tidak valid.'; end if;
  v_id := nullif(p_data->>'id','')::uuid;
  case p_action
  when 'account' then
    if v_id=v_actor or exists(select 1 from private.admin_members where user_id=v_id and active) then raise exception 'Akun admin aktif tidak dapat ditangguhkan.'; end if;
    if not exists(select 1 from public.profiles where id=v_id) then raise exception 'Akun tidak ditemukan.'; end if;
    v_status:=p_data->>'status';
    if v_status not in ('active','suspended') or v_status is null then raise exception 'Status akun tidak valid.'; end if;
    if v_status='suspended' and char_length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Alasan penangguhan wajib diisi.'; end if;
    insert into private.account_controls(user_id,status,reason,updated_by) values(v_id,v_status,left(coalesce(p_data->>'reason',''),500),v_actor)
      on conflict(user_id) do update set status=excluded.status,reason=excluded.reason,updated_by=v_actor,updated_at=now();
  when 'review' then
    if not exists(select 1 from public.app_reviews where id=v_id) then raise exception 'Review tidak ditemukan.'; end if;
    insert into private.review_followups(review_id,status,note,handled_by)
      values(v_id,p_data->>'status',left(coalesce(p_data->>'note',''),2000),v_actor)
      on conflict(review_id) do update set status=excluded.status,note=excluded.note,handled_by=v_actor,updated_at=now();
  when 'ticket' then
    update private.support_tickets set status=p_data->>'status',priority=p_data->>'priority',
      reply=left(coalesce(p_data->>'reply',''),4000),internal_note=left(coalesce(p_data->>'internal_note',''),2000),handled_by=v_actor,updated_at=now() where id=v_id;
    if not found then raise exception 'Tiket tidak ditemukan.'; end if;
  when 'member' then
    perform pg_advisory_xact_lock(813624);
    select id into v_id from auth.users where lower(email)=lower(trim(p_data->>'email'));
    if v_id is null then raise exception 'Akun tidak ditemukan.'; end if;
    if v_id=v_actor then raise exception 'Gunakan akun pemilik lain untuk mengubah akses Anda.'; end if;
    if not exists(select 1 from auth.users where id=v_id and email_confirmed_at is not null) or not private.account_enabled(v_id) then raise exception 'Akun harus aktif dan email terverifikasi.'; end if;
    insert into private.admin_members(user_id,role,active) values(v_id,p_data->>'role',(p_data->>'active')::boolean)
      on conflict(user_id) do update set role=excluded.role,active=excluded.active;
  when 'settings' then
    update private.website_settings set site_name=trim(p_data->>'site_name'),support_email=trim(coalesce(p_data->>'support_email','')),
      maintenance_mode=(p_data->>'maintenance_mode')::boolean,updated_at=now() where id;
  when 'announcement_save' then
    if v_id is not null and not exists(select 1 from private.announcements where id=v_id and status='draft') then raise exception 'Hanya draf yang dapat diubah.'; end if;
    if jsonb_typeof(p_data->'target_emails')='array' then
      if jsonb_array_length(p_data->'target_emails')=0 then raise exception 'Pilih minimal satu akun tujuan.'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_data->'target_emails') e where not exists(select 1 from auth.users u where lower(u.email)=lower(trim(e)))) then raise exception 'Email penerima tidak ditemukan.'; end if;
      select array_agg(id) into v_targets from auth.users where lower(email) in (select lower(trim(e)) from jsonb_array_elements_text(p_data->'target_emails') e);
    end if;
    v_id:=coalesce(v_id,gen_random_uuid());
    insert into private.announcements(id,title,body,target_users,publish_at,expires_at,created_by)
      values(v_id,trim(p_data->>'title'),trim(p_data->>'body'),
        v_targets,
        coalesce(nullif(p_data->>'publish_at','')::timestamptz,now()),nullif(p_data->>'expires_at','')::timestamptz,v_actor)
      on conflict(id) do update set title=excluded.title,body=excluded.body,target_users=excluded.target_users,publish_at=excluded.publish_at,expires_at=excluded.expires_at,updated_at=now();
  when 'announcement_publish' then
    update private.announcements set status='scheduled',updated_at=now() where id=v_id and status='draft' and (expires_at is null or expires_at>now());
    if not found then raise exception 'Draf tidak ditemukan atau sudah kedaluwarsa.'; end if;
    perform private.publish_announcements(v_id);
  when 'announcement_cancel' then
    update private.announcements set status='cancelled',updated_at=now() where id=v_id and status<>'cancelled';
    if not found then raise exception 'Pengumuman tidak ditemukan.'; end if;
    delete from public.notifications where ref_key='announcement:'||v_id;
  when 'expense' then
    if v_id is not null then raise exception 'Input tidak valid.'; end if;
    insert into private.platform_expenses(expense_date,category,description,amount,created_by)
      values((p_data->>'expense_date')::date,p_data->>'category',trim(p_data->>'description'),(p_data->>'amount')::numeric,v_actor) returning id into v_id;
  when 'expense_archive' then
    update private.platform_expenses set archived_at=now() where id=v_id and archived_at is null;
    if not found then raise exception 'Biaya tidak ditemukan.'; end if;
  else raise exception 'Tindakan admin tidak valid.';
  end case;
  insert into private.admin_audit(actor_id,action,target_id,details)
    values(v_actor,p_action,v_id::text,jsonb_build_object('status',p_data->>'status','role',p_data->>'role'));
  return jsonb_build_object('id',v_id);
end $$;
create function public.admin_mutate(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.admin_mutate(p_action,p_data); $$;

create function private.publish_announcements(p_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare a record; v_count integer:=0; begin
  for a in select * from private.announcements where status='scheduled' and publish_at<=now()
    and (p_id is null or id=p_id) for update skip locked loop
    if a.expires_at is not null and a.expires_at<=now() then
      update private.announcements set status='cancelled',updated_at=now() where id=a.id;
      continue;
    end if;
    insert into public.notifications(user_id,type,ref_key,title,body,link)
      select p.id,'info','announcement:'||a.id,a.title,a.body,'/support?tab=announcements'
      from public.profiles p where private.app_accessible(p.id) and (a.target_users is null or p.id=any(a.target_users))
      on conflict(user_id,ref_key) do nothing;
    update private.announcements set status='published',updated_at=now() where id=a.id;
    v_count:=v_count+1;
  end loop;
  if p_id is null then
    insert into private.service_runs(service,outcome,processed,sent) values('announcements','ok',v_count,v_count);
    delete from private.service_runs where created_at<now()-interval '30 days';
  end if;
  return v_count;
end $$;
create function public.publish_site_announcements() returns integer
language sql security invoker set search_path='' as $$ select private.publish_announcements(); $$;
create function private.teacher_support(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; begin
  if not private.app_accessible(v_uid) then raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501'; end if;
  case p_action
  when 'create' then
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 9713));
    if (select count(*) from private.support_tickets where user_id=v_uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Terlalu banyak tiket. Silakan coba lagi nanti.'; end if;
    insert into private.support_tickets(user_id,subject,message,category) values(v_uid,trim(p_data->>'subject'),trim(p_data->>'message'),p_data->>'category') returning id into v_id;
    return jsonb_build_object('id',v_id);
  when 'tickets' then
    return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,subject,message,category,status,reply,created_at,updated_at from private.support_tickets where user_id=v_uid order by created_at desc limit 100) x);
  when 'announcements' then
    return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,title,body,publish_at from private.announcements where status='published' and publish_at<=now() and (expires_at is null or expires_at>now()) and (target_users is null or v_uid=any(target_users)) order by publish_at desc limit 100) x);
  else raise exception 'Input tidak valid.';
  end case;
end $$;
create function public.teacher_support(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.teacher_support(p_action,p_data); $$;
create function private.record_service_run(p_service text,p_outcome text,p_processed integer,p_sent integer,p_failed integer,p_duration_ms integer,p_message text)
returns void language plpgsql security definer set search_path='' as $$ begin
  insert into private.service_runs(service,outcome,processed,sent,failed,duration_ms,message)
    values(p_service,p_outcome,p_processed,p_sent,p_failed,p_duration_ms,left(coalesce(p_message,''),200));
  delete from private.service_runs where created_at<now()-interval '30 days';
end $$;
create function public.record_service_run(p_service text,p_outcome text,p_processed integer default 0,p_sent integer default 0,p_failed integer default 0,p_duration_ms integer default 0,p_message text default '')
returns void language sql security invoker set search_path='' as $$ select private.record_service_run(p_service,p_outcome,p_processed,p_sent,p_failed,p_duration_ms,p_message); $$;
create function private.push_blocked_accounts() returns uuid[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(id),'{}'::uuid[]) from public.profiles where not private.app_accessible(id);
$$;
create function public.get_push_blocked_accounts() returns uuid[]
language sql security invoker set search_path='' as $$ select private.push_blocked_accounts(); $$;

-- Default privileges are revoked for every new function, then granted by scope.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
    (n.nspname='private' and p.proname in ('account_enabled','app_accessible','current_admin_role','admin_mfa_verified','require_admin','admin_access','account_access','site_config','admin_read','admin_mutate','publish_announcements','teacher_support','record_service_run','push_blocked_accounts'))
    or (n.nspname='public' and p.proname in ('get_admin_access','get_account_access','get_site_config','is_account_enabled','admin_read','admin_mutate','publish_site_announcements','teacher_support','record_service_run','get_push_blocked_accounts')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname in ('record_service_run','publish_announcements','publish_site_announcements','get_push_blocked_accounts','push_blocked_accounts','is_account_enabled') then
      execute format('grant execute on function %s to service_role',f.signature);
    else
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
    if f.proname in ('account_enabled','app_accessible','site_config','get_site_config') then
      execute format('grant execute on function %s to anon,service_role',f.signature);
    end if;
  end loop;
end $$;
grant usage on schema private to anon,authenticated,service_role;
-- Only a guarded mutation or the scheduler may publish; no direct caller publication.
revoke execute on function private.publish_announcements(uuid) from authenticated;

do $$ begin
  if exists(select 1 from pg_namespace where nspname='cron') then
    perform cron.schedule('publish-site-announcements','* * * * *','select private.publish_announcements();');
  end if;
end $$;
