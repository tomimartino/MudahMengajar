-- Preserve legacy duplicate rows; reject new conflicts, including simultaneous inserts.
-- A non-unique lookup index is intentional: existing teaching/payment records are retained.
create index idx_students_normalized_name on public.students
  (user_id, lower(btrim(regexp_replace(full_name, '[[:space:]]+', ' ', 'g'))))
  where deleted_at is null;

create function private.prevent_duplicate_student_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text := lower(btrim(regexp_replace(new.full_name, '[[:space:]]+', ' ', 'g')));
begin
  if new.deleted_at is not null then return new; end if;
  -- Existing duplicates may still be edited or receive new packages without renaming them.
  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.user_id = old.user_id
      and normalized_name = lower(btrim(regexp_replace(old.full_name, '[[:space:]]+', ' ', 'g'))) then
      return new;
    end if;
  end if;

  -- Serialize writes for the same teacher/name. The volatile trigger's lookup after the
  -- lock sees committed competing inserts under the Data API's READ COMMITTED isolation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('student-name:' || new.user_id::text || ':' || normalized_name, 0));
  if exists (
    select 1 from public.students s
    where s.user_id = new.user_id and s.deleted_at is null and s.id <> new.id
      and lower(btrim(regexp_replace(s.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
  ) then
    raise exception 'Murid dengan nama yang sama sudah terdaftar. Gunakan Tambah Paket untuk menambah pertemuan.'
      using errcode = '23505', constraint = 'students_name_per_teacher';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_duplicate_student_name() from public, anon, authenticated;

create trigger prevent_duplicate_student_name
before insert or update of full_name, user_id, deleted_at on public.students
for each row execute function private.prevent_duplicate_student_name();

-- Preflight validation before the application creates parent/billing/schedule records.
-- RLS plus explicit ownership keeps this lookup scoped to the signed-in teacher.
create function public.student_name_conflicts(p_name text, p_student_id uuid default null)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  normalized_name text := lower(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')));
begin
  if uid is null then raise exception 'Tidak terautentikasi.'; end if;
  if p_student_id is not null and exists (
    select 1 from public.students s where s.id = p_student_id and s.user_id = uid and s.deleted_at is null
      and lower(btrim(regexp_replace(s.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
  ) then return false; end if;
  return exists (
    select 1 from public.students s where s.user_id = uid and s.deleted_at is null
      and s.id is distinct from p_student_id
      and lower(btrim(regexp_replace(s.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
  );
end;
$$;
revoke all on function public.student_name_conflicts(text, uuid) from public, anon;
grant execute on function public.student_name_conflicts(text, uuid) to authenticated;
