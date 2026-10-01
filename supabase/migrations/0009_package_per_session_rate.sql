-- ============================= 0009: tarif per pertemuan paket & pembatalan jadwal =============================

alter table public.student_packages
  add column per_session_rate numeric(12, 0)
  check (per_session_rate is null or per_session_rate > 0);

-- ============================= RPC: create_package (tambah p_per_session_rate) =============================

create or replace function public.create_package(
  p_student_id uuid,
  p_total_sessions int,
  p_price numeric,
  p_start_date date,
  p_per_session_rate numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seq int;
  v_number text;
  v_invoice_id uuid;
  v_pkg_id uuid;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_total_sessions <= 0 or p_price <= 0 then
    raise exception 'Jumlah pertemuan dan harga harus lebih dari 0' using errcode = 'P0001';
  end if;
  if p_per_session_rate is not null and p_per_session_rate <= 0 then
    raise exception 'Tarif per pertemuan harus lebih dari 0' using errcode = 'P0001';
  end if;

  perform 1 from public.students
    where id = p_student_id and user_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'Siswa tidak ditemukan' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_seq:' || v_uid::text));

  select coalesce(
    max(((regexp_match(invoice_number, '^INV-\d{4}-(\d+)$'))[1])::int), 0
  ) + 1 into v_seq
    from public.invoices where user_id = v_uid;

  v_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.invoices (user_id, student_id, invoice_number, type, period_label, amount, due_date, status)
  values (v_uid, p_student_id, v_number, 'package', 'Paket ' || p_total_sessions || 'x Pertemuan',
          p_price, p_start_date, 'unpaid')
  returning id into v_invoice_id;

  insert into public.student_packages (user_id, student_id, invoice_id, total_sessions, price, per_session_rate, start_date)
  values (v_uid, p_student_id, v_invoice_id, p_total_sessions, p_price, p_per_session_rate, p_start_date)
  returning id into v_pkg_id;

  return jsonb_build_object('package_id', v_pkg_id, 'invoice_id', v_invoice_id, 'invoice_number', v_number);
end;
$$;

-- ============================= RPC: cancel_schedule (opsional kurangi harga paket) =============================

create or replace function public.cancel_schedule(
  p_schedule_id uuid,
  p_reduce_price boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_pkg record;
  v_new_amount numeric;
  v_paid numeric;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  select student_id into v_student_id
    from public.schedules
    where id = p_schedule_id and user_id = v_uid and status = 'scheduled';
  if v_student_id is null then
    raise exception 'Jadwal tidak ditemukan atau sudah dibatalkan' using errcode = 'P0001';
  end if;

  update public.schedules
    set status = 'cancelled', updated_at = now()
    where id = p_schedule_id;

  if p_reduce_price then
    select * into v_pkg from public.student_packages
      where user_id = v_uid and student_id = v_student_id and status = 'active'
      order by created_at desc
      limit 1
      for update;
    if found and v_pkg.per_session_rate is not null and v_pkg.per_session_rate > 0 then
      update public.student_packages
        set price = greatest(price - per_session_rate, 0), updated_at = now()
        where id = v_pkg.id;

      if v_pkg.invoice_id is not null then
        update public.invoices
          set amount = greatest(amount - v_pkg.per_session_rate, 0), updated_at = now()
          where id = v_pkg.invoice_id
          returning amount into v_new_amount;

        select coalesce(sum(amount), 0) into v_paid
          from public.payments
          where invoice_id = v_pkg.invoice_id;

        if v_paid >= v_new_amount then
          v_status := 'paid';
        elsif v_paid > 0 then
          v_status := 'partial';
        else
          v_status := 'unpaid';
        end if;

        update public.invoices set status = v_status where id = v_pkg.invoice_id;
      end if;
    end if;
  end if;
end;
$$;

-- ============================= GRANTS =============================

grant execute on function public.create_package(uuid, int, numeric, date, numeric) to authenticated;
grant execute on function public.cancel_schedule(uuid, boolean) to authenticated;
