-- Portal access and original teacher mutations; fixtures are always rolled back.
begin;
do $$
declare
  u uuid=gen_random_uuid(); other_u uuid=gen_random_uuid();
  student uuid=gen_random_uuid(); other_student uuid=gen_random_uuid();
  subject uuid=gen_random_uuid(); scheduled uuid; session_id uuid; invoice uuid;
  hashed text=repeat('a',64); balances jsonb;
begin
  if to_regclass('public.assignments') is not null or to_regclass('public.audit_logs') is not null
    or to_regclass('public.payment_orders') is not null or to_regclass('public.booking_slots') is not null
    or to_regprocedure('public.archive_student(uuid,boolean)') is not null
    or to_regprocedure('public.reserve_midtrans_order(uuid,text)') is not null then
    raise exception 'Removed features remain available';
  end if;
  insert into auth.users(id,email,raw_user_meta_data) values
    (u,u::text||'@example.invalid','{}'),(other_u,other_u::text||'@example.invalid','{}');
  insert into public.students(id,user_id,full_name,school_level,grade_level,billing_type,per_session_rate) values
    (student,u,'Portal QA','SD','4','per_session',50000),
    (other_student,other_u,'Other QA','SD','4','per_session',50000);
  insert into public.subjects(id,user_id,name) values(subject,u,'Matematika');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.rotate_portal_link(student,hashed);
  if (private.portal_student(hashed)).id is distinct from student then raise exception 'Portal lookup failed'; end if;
  if (private.portal_student(repeat('b',64))).id is not null then raise exception 'Invalid token accepted'; end if;
  insert into public.schedules(user_id,student_id,subject_id,start_at,end_at)
    values(u,student,subject,now()-interval '2 hours',now()-interval '1 hour') returning id into scheduled;
  -- The original completion RPC must still store PR without an assignment table.
  session_id=public.complete_session(p_schedule_id=>scheduled,p_attendance=>'hadir',
    p_duration_minutes=>60,p_material=>'Pecahan',p_homework=>'Soal 1-5',p_score=>80);
  if not exists(select 1 from public.sessions where id=session_id and homework='Soal 1-5') then
    raise exception 'Original PR recording failed';
  end if;
  update public.sessions set homework='Soal 6-10' where id=session_id;
  if not exists(select 1 from public.sessions where id=session_id and homework='Soal 6-10') then
    raise exception 'Original PR edit failed';
  end if;
  insert into public.invoices(user_id,student_id,invoice_number,type,amount,status) values
    (u,student,'QA-'||gen_random_uuid(),'other',100000,'unpaid') returning id into invoice;
  insert into public.invoices(user_id,student_id,invoice_number,type,amount,status) values
    (other_u,other_student,'OTHER-'||gen_random_uuid(),'other',999000,'unpaid');
  perform public.record_payment(student,invoice,'other',25000,current_date,'cash',null);
  balances=public.portal_invoice_balances(hashed);
  if jsonb_array_length(balances)<>1 or (balances->0->>'id')::uuid<>invoice
    or (balances->0->>'paid_total')::numeric<>25000 then raise exception 'Portal balance leaked or incorrect'; end if;
  if public.portal_invoice_balances(repeat('b',64))<>'[]'::jsonb then raise exception 'Invalid portal saw invoices'; end if;
  perform set_config('role','authenticated',true);
  if exists(select 1 from public.portal_links where user_id<>u) then raise exception 'Portal RLS leak'; end if;
  if has_function_privilege('authenticated','public.portal_invoice_balances(text)','execute')
    or has_function_privilege('anon','public.rotate_portal_link(uuid,text)','execute') then
    raise exception 'Privileged portal RPC exposed';
  end if;
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  if exists(select 1 from public.portal_links where student_id=student) then raise exception 'Other teacher saw portal'; end if;
  begin
    perform public.rotate_portal_link(student,repeat('c',64));
    raise exception 'Other teacher rotated portal';
  exception when sqlstate 'P0001' then if sqlerrm='Other teacher rotated portal' then raise; end if; end;
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.portal_links set revoked_at=now() where student_id=student;
  if (private.portal_student(hashed)).id is not null then raise exception 'Revoked portal accepted'; end if;
  perform public.rotate_portal_link(student,repeat('c',64));
  if (private.portal_student(hashed)).id is not null then raise exception 'Old token survived rotation'; end if;
  update public.students set status='inactive' where id=student;
  if (private.portal_student(repeat('c',64))).id is not null then raise exception 'Inactive student portal accepted'; end if;
  update public.students set status='active' where id=student;
  update public.portal_links set expires_at=now()-interval '1 second' where student_id=student;
  if (private.portal_student(repeat('c',64))).id is not null then raise exception 'Expired portal accepted'; end if;
  -- Original deletion cascades the portal link, so a saved token cannot reopen it.
  delete from public.attendance where student_id=student;
  delete from public.sessions where student_id=student;
  delete from public.schedules where student_id=student;
  delete from public.payments where student_id=student;
  delete from public.students where id=student;
  if exists(select 1 from public.portal_links where student_id=student) then raise exception 'Deleted student retained portal'; end if;
end $$;
rollback;
select 'PASS: parent portal isolation, revocation, balances and original teacher features' as result;
