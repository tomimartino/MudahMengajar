-- Package-specific form snapshots and schedule ownership keep edits isolated.
alter table public.student_packages
  add column form_settings jsonb check (form_settings is null or jsonb_typeof(form_settings) = 'object'),
  add constraint student_packages_owner_key unique (id, user_id, student_id);
alter table public.schedules add column package_id uuid;
alter table public.schedules add constraint schedules_package_owner_fk
  foreign key (package_id, user_id, student_id)
  references public.student_packages(id, user_id, student_id) on delete set null (package_id);
create index schedules_package_id_idx on public.schedules(package_id) where package_id is not null;

-- Legacy creation batches: assign only when exactly one package matches the batch.
with matches as (
  select s.id, (array_agg(p.id))[1] as package_id
  from public.schedules s join public.student_packages p
    on p.user_id = s.user_id and p.student_id = s.student_id
    and abs(extract(epoch from s.created_at - p.created_at)) <= 5
  where s.package_id is null
  group by s.id having count(*) = 1
)
update public.schedules s set package_id = m.package_id from matches m where s.id = m.id;

-- Infer the original form from that package's own rows, never another month's rows.
update public.student_packages p set form_settings = jsonb_build_object(
  'learning_mode', coalesce((select x.learning_mode from public.schedules x where x.package_id=p.id order by x.start_at limit 1), s.learning_mode),
  'subject_ids', coalesce((select jsonb_agg(distinct x.subject_id) from public.schedules x where x.package_id=p.id),
    (select jsonb_agg(x.subject_id order by x.subject_id) from public.student_subjects x where x.student_id=p.student_id and x.user_id=p.user_id), '[]'::jsonb),
  'schedule_start_date', coalesce((select min((x.start_at at time zone pr.timezone)::date) from public.schedules x where x.package_id=p.id), p.start_date),
  'schedule_times', coalesce((select jsonb_agg(jsonb_build_object('day',t.day,'start_time',t.time) order by t.day) from (
    select distinct on (extract(isodow from x.start_at at time zone pr.timezone))
      extract(isodow from x.start_at at time zone pr.timezone)::int as day,
      to_char(x.start_at at time zone pr.timezone,'HH24:MI') as time
    from public.schedules x where x.package_id=p.id
    order by extract(isodow from x.start_at at time zone pr.timezone), x.start_at
  ) t), '[]'::jsonb),
  'schedule_location', coalesce((select x.location from public.schedules x where x.package_id=p.id order by x.start_at limit 1), ''),
  'duration_minutes', coalesce((select (extract(epoch from x.end_at-x.start_at)/60)::int from public.schedules x where x.package_id=p.id order by x.start_at limit 1),
    (select st.default_duration_minutes from public.settings st where st.user_id=p.user_id),90)
)
from public.students s join public.profiles pr on pr.id=s.user_id
where p.student_id=s.id and p.user_id=s.user_id and p.form_settings is null;

create function public.update_student_package(
  p_student_id uuid, p_package_id uuid, p_total_sessions int,
  p_per_session_rate numeric, p_price numeric, p_settings jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pkg public.student_packages;
  v_invoice public.invoices;
  v_paid numeric;
  v_start date;
  v_tz text;
  v_duration int;
  v_completed int;
  v_last_completed timestamptz;
  v_needed int;
  v_starts timestamptz[];
  v_due date;
  v_settings jsonb;
  v_changed boolean;
begin
  if v_uid is null then raise exception 'Silakan masuk kembali.'; end if;
  -- RLS, including the restrictive account_active_guard, remains enforced.
  select * into v_pkg from public.student_packages
    where id=p_package_id and student_id=p_student_id and user_id=v_uid for update;
  if not found or v_pkg.status='cancelled' then raise exception 'Paket tidak ditemukan.'; end if;
  perform 1 from public.students where id=p_student_id and user_id=v_uid and deleted_at is null;
  if not found then raise exception 'Murid tidak ditemukan.'; end if;
  if p_total_sessions is null or p_total_sessions not between 1 and 200 or
    p_per_session_rate is null or p_per_session_rate<=0 or p_price is null or p_price<=0 then
    raise exception 'Jumlah pertemuan dan harga harus lebih dari 0.';
  end if;
  if p_total_sessions<v_pkg.sessions_used then raise exception 'Jumlah pertemuan tidak boleh kurang dari paket yang sudah terpakai.'; end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or
    coalesce(p_settings->>'learning_mode','') not in ('offline','online','hybrid') or
    jsonb_typeof(p_settings->'subject_ids') is distinct from 'array' or
    jsonb_typeof(p_settings->'schedule_times') is distinct from 'array' then
    raise exception 'Pengaturan paket tidak valid.';
  end if;
  if jsonb_array_length(p_settings->'subject_ids')=0 or
    exists(select 1 from jsonb_array_elements_text(p_settings->'subject_ids') a(id)
      where not exists(select 1 from public.subjects s where s.id=a.id::uuid and s.user_id=v_uid)) then
    raise exception 'Pilih mata pelajaran milik Anda.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_settings->'schedule_times') t
    where coalesce(t->>'day','') !~ '^[1-7]$' or coalesce(t->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or
    (select count(*)<>count(distinct t->>'day') from jsonb_array_elements(p_settings->'schedule_times') t) then
    raise exception 'Hari atau jam jadwal tidak valid.';
  end if;
  v_start := (p_settings->>'schedule_start_date')::date;
  if v_start is null then raise exception 'Tanggal mulai wajib diisi.'; end if;
  select timezone into v_tz from public.profiles where id=v_uid;
  v_tz:=coalesce(v_tz,'Asia/Jakarta');
  v_duration:=coalesce((v_pkg.form_settings->>'duration_minutes')::int,90);
  v_settings:=jsonb_build_object('learning_mode',p_settings->>'learning_mode',
    'subject_ids',p_settings->'subject_ids','schedule_start_date',v_start,
    'schedule_times',p_settings->'schedule_times','schedule_location',coalesce(p_settings->>'schedule_location',''),
    'duration_minutes',v_duration);
  v_paid:=0;
  if v_pkg.invoice_id is not null then
    select * into v_invoice from public.invoices where id=v_pkg.invoice_id and user_id=v_uid for update;
    if not found then raise exception 'Tagihan paket tidak ditemukan.'; end if;
    select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=v_invoice.id and user_id=v_uid;
  end if;
  if p_price<v_paid then raise exception 'Harga paket tidak boleh kurang dari pembayaran yang sudah dicatat.'; end if;

  perform 1 from public.schedules where package_id=v_pkg.id and user_id=v_uid for update;
  select count(*),max(start_at) into v_completed,v_last_completed from public.schedules
    where package_id=v_pkg.id and user_id=v_uid and status='completed';
  if p_total_sessions<v_completed then raise exception 'Jumlah pertemuan tidak boleh kurang dari pertemuan yang sudah selesai.'; end if;
  v_changed := v_pkg.total_sessions<>p_total_sessions or
    v_pkg.form_settings->'schedule_start_date' is distinct from v_settings->'schedule_start_date' or
    v_pkg.form_settings->'schedule_times' is distinct from v_settings->'schedule_times';
  v_due:=v_pkg.start_date;
  if v_changed then
    v_needed:=p_total_sessions-greatest(v_pkg.sessions_used,v_completed);
    select coalesce(array_agg(c.start_at order by c.start_at),'{}'::timestamptz[]) into v_starts from (
      select ((v_start+d.n)::text || ' ' || (t->>'start_time'))::timestamp at time zone v_tz as start_at
      from generate_series(0,2000) d(n) cross join jsonb_array_elements(v_settings->'schedule_times') t
      where extract(isodow from v_start+d.n)::int=(t->>'day')::int
        and (v_last_completed is null or ((v_start+d.n)::text || ' ' || (t->>'start_time'))::timestamp at time zone v_tz>v_last_completed)
        and not exists(select 1 from public.schedules s where s.package_id=v_pkg.id and s.status<>'scheduled'
          and (s.start_at at time zone v_tz)::date=v_start+d.n)
      order by start_at limit v_needed
    ) c;
    if jsonb_array_length(v_settings->'schedule_times')>0 and cardinality(v_starts)<>v_needed then
      raise exception 'Jadwal paket belum dapat disusun.';
    end if;
    if exists(select 1 from public.schedules s where s.user_id=v_uid and s.student_id=p_student_id
      and s.package_id is distinct from v_pkg.id and s.start_at=any(v_starts)) then
      raise exception 'Jadwal bertabrakan dengan paket lain. Pilih tanggal atau jam lain.';
    end if;
    delete from public.schedules where package_id=v_pkg.id and user_id=v_uid and status='scheduled'
      and not(start_at=any(v_starts));
    insert into public.schedules(user_id,student_id,package_id,subject_id,start_at,end_at,learning_mode,location,status)
      select v_uid,p_student_id,v_pkg.id,(v_settings->'subject_ids'->>0)::uuid,
        d.start_at,d.start_at+make_interval(mins=>v_duration),v_settings->>'learning_mode',nullif(v_settings->>'schedule_location',''),
        case when d.start_at<now() then 'completed' else 'scheduled' end
      from unnest(v_starts) d(start_at) where not exists(select 1 from public.schedules s
        where s.package_id=v_pkg.id and s.start_at=d.start_at);
    select coalesce(max((s.start_at at time zone v_tz)::date),v_start) into v_due from public.schedules s
      where s.package_id=v_pkg.id and s.status<>'cancelled';
  end if;
  update public.schedules set subject_id=(v_settings->'subject_ids'->>0)::uuid,
    learning_mode=v_settings->>'learning_mode',location=nullif(v_settings->>'schedule_location',''),
    end_at=start_at+make_interval(mins=>v_duration)
    where package_id=v_pkg.id and user_id=v_uid and status='scheduled' and
      (subject_id is distinct from (v_settings->'subject_ids'->>0)::uuid or
       learning_mode is distinct from v_settings->>'learning_mode' or
       location is distinct from nullif(v_settings->>'schedule_location',''));
  update public.student_packages set total_sessions=p_total_sessions,per_session_rate=p_per_session_rate,
    price=p_price,start_date=v_due,form_settings=v_settings,
    status=case when sessions_used>=p_total_sessions then 'completed' else 'active' end
    where id=v_pkg.id and user_id=v_uid;
  update public.invoices set amount=p_price,due_date=v_due,period_label='Paket '||p_total_sessions||'x Pertemuan',
    status=case when v_paid>=p_price then 'paid' when v_paid>0 then 'partial' else 'unpaid' end
    where id=v_invoice.id and user_id=v_uid;
end;
$$;
revoke all on function public.update_student_package(uuid,uuid,int,numeric,numeric,jsonb) from public,anon;
grant execute on function public.update_student_package(uuid,uuid,int,numeric,numeric,jsonb) to authenticated;
