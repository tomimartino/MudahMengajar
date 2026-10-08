-- All data and notification changes are rolled back.
begin;
do $$
declare
  u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid();
  student uuid := gen_random_uuid(); other_student uuid := gen_random_uuid();
  upcoming uuid := gen_random_uuid(); overdue uuid := gen_random_uuid(); partial uuid := gen_random_uuid();
  paid uuid := gen_random_uuid(); future uuid := gen_random_uuid(); other_invoice uuid := gen_random_uuid();
  v_now timestamptz := now(); v_today date := (now() at time zone 'Asia/Jakarta')::date;
  saved_id uuid; saved_created timestamptz; saved_read timestamptz; v_key text;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (u, u::text || '@example.invalid', '{}'), (other_u, other_u::text || '@example.invalid', '{}');
  update public.profiles set timezone = 'Asia/Jakarta' where id in (u, other_u);
  update public.settings set notify_payment = true, payment_reminder_days = 3,
    notify_schedule = false, notify_material = false, notify_package = false where user_id in (u, other_u);
  insert into public.students(id, user_id, full_name, school_level, grade_level) values
    (student, u, 'Murid Pembayaran QA', 'SD', '4'), (other_student, other_u, 'Murid Guru Lain', 'SD', '4');
  insert into public.invoices(id, user_id, student_id, invoice_number, type, amount, due_date, status) values
    (upcoming, u, student, 'QA-UPCOMING', 'package', 300000, v_today + 2, 'unpaid'),
    (overdue, u, student, 'QA-OVERDUE', 'package', 300000, v_today - 4, 'unpaid'),
    (partial, u, student, 'QA-PARTIAL', 'package', 300000, v_today - 4, 'partial'),
    (paid, u, student, 'QA-PAID', 'package', 300000, v_today - 4, 'paid'),
    (future, u, student, 'QA-FUTURE', 'package', 300000, v_today + 10, 'unpaid'),
    (other_invoice, other_u, other_student, 'QA-OTHER', 'package', 300000, v_today - 1, 'unpaid');
  v_key := 'payment_overdue:' || overdue;
  insert into public.notifications(user_id, type, ref_key, title, body, link, read_at)
    values(u, 'payment_overdue', v_key, 'Pembayaran terlambat', 'Teks lama', '/payments', now())
    returning id, created_at, read_at into saved_id, saved_created, saved_read;
  insert into public.push_log(user_id, ref_key) values(u, v_key);
  insert into public.notifications(user_id, type, ref_key, title) values
    (u, 'payment_due', 'payment_due:' || future, 'Pengingat terlalu awal'),
    (u, 'payment_overdue', 'payment_overdue:' || paid, 'Tagihan sudah lunas'),
    (other_u, 'payment_overdue', 'payment_overdue:' || other_invoice, 'Pengingat guru lain');

  perform private.refresh_payment_reminders(u, v_now);
  if (select count(*) from public.notifications where user_id = u) <> 3 then
    raise exception 'Expected only due-window unpaid/partial reminders';
  end if;
  if not exists(select 1 from public.notifications where id = saved_id and title = 'Belum Bayar · Murid Pembayaran QA'
    and body like '%QA-OVERDUE%belum dibayar.%' and link = '/payments?month=' || to_char(v_today - 4, 'YYYY-MM')
    and created_at = saved_created and read_at = saved_read) then raise exception 'Wrong unpaid status or read state'; end if;
  if not exists(select 1 from public.notifications where user_id = u and ref_key = 'payment_due:' || upcoming
    and title = 'Belum Bayar · Murid Pembayaran QA') then raise exception 'Upcoming unpaid status incorrect'; end if;
  if not exists(select 1 from public.notifications where user_id = u and ref_key = 'payment_overdue:' || partial
    and title = 'Sebagian · Murid Pembayaran QA' and body like '%baru dibayar sebagian.%') then
    raise exception 'Partial payment status incorrect'; end if;
  if exists(select 1 from public.notifications where user_id = u and
    (title ilike '%jatuh tempo%' or title ilike '%terlambat%')) then raise exception 'Due date overrode payment status'; end if;
  perform public.refresh_reminders_for_user(u);
  if (select count(*) from public.notifications where user_id = u) <> 3
    or not exists(select 1 from public.notifications where id = saved_id and read_at = saved_read)
    or not exists(select 1 from public.push_log where user_id = u and ref_key = v_key) then
    raise exception 'Public refresh duplicated reminder or discarded read/sent state'; end if;
  if not exists(select 1 from public.notifications where user_id = other_u and title = 'Pengingat guru lain') then
    raise exception 'Reminder refresh touched another teacher'; end if;

  update public.invoices set status = 'partial' where id = overdue;
  perform private.refresh_payment_reminders(u, v_now);
  if not exists(select 1 from public.notifications where id = saved_id and title = 'Sebagian · Murid Pembayaran QA'
    and read_at = saved_read) then raise exception 'Partial status update reset notification'; end if;
  update public.invoices set status = 'paid' where id = overdue;
  perform private.refresh_payment_reminders(u, v_now);
  if exists(select 1 from public.notifications where id = saved_id) then raise exception 'Paid reminder remained'; end if;
  update public.settings set notify_payment = false where user_id = u;
  perform private.refresh_payment_reminders(u, v_now);
  if exists(select 1 from public.notifications where user_id = u) then raise exception 'Disabled reminders remained'; end if;
  if has_function_privilege('anon', 'private.refresh_payment_reminders(uuid,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'private.refresh_payment_reminders(uuid,timestamptz)', 'execute') then
    raise exception 'Payment helper exposed to public callers'; end if;
  if strpos(pg_get_functiondef('public.refresh_reminders_for_user(uuid)'::regprocedure), 'private.app_accessible(p_uid)') = 0 then
    raise exception 'ERP account-access guard removed'; end if;
end $$;
rollback;
select 'PASS: payment status text, reminder windows, paid cleanup, read/sent state and teacher isolation' as result;
