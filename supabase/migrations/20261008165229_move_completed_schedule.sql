-- Move one occurrence and its existing lesson together, keeping package usage unchanged.
create or replace function public.move_schedule(
  p_schedule_id uuid,
  p_date date,
  p_time time without time zone
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_schedule public.schedules%rowtype;
  v_timezone text;
  v_start timestamptz;
  v_shift interval;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi.';
  end if;
  if p_date is null or p_time is null or not isfinite(p_date) or p_time >= time '24:00' then
    raise exception 'Tanggal atau jam tidak valid.';
  end if;

  select * into v_schedule
  from public.schedules
  where id = p_schedule_id and user_id = v_user
  for update;

  if not found or v_schedule.status not in ('scheduled', 'completed') then
    raise exception 'Jadwal tidak ditemukan atau sudah dibatalkan.';
  end if;
  if not exists (
    select 1 from public.students
    where id = v_schedule.student_id and user_id = v_user and deleted_at is null
  ) then
    raise exception 'Murid tidak ditemukan.';
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_timezone
  from public.profiles where id = v_user;
  v_start := (p_date + p_time) at time zone v_timezone;
  v_shift := v_start - v_schedule.start_at;

  update public.schedules
  set start_at = v_start,
      end_at = v_start + (v_schedule.end_at - v_schedule.start_at)
  where id = v_schedule.id and user_id = v_user;

  -- Historical packages can contain completed schedules with no material yet.
  -- Only shift existing lessons; do not create a session or deduct a package again.
  update public.sessions
  set session_date = p_date,
      started_at = started_at + v_shift,
      ended_at = ended_at + v_shift
  where schedule_id = v_schedule.id and user_id = v_user;
end;
$$;

revoke all on function public.move_schedule(uuid, date, time without time zone) from public, anon;
grant execute on function public.move_schedule(uuid, date, time without time zone) to authenticated;
