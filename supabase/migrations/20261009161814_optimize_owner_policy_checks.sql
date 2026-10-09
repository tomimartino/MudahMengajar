-- Cache the caller UID once per statement, preserving ownership predicates,
-- policy roles, commands, and the separate restrictive account guards.
do $$
declare p record; v_sql text;
begin
  for p in select tablename,policyname,qual,with_check from pg_policies
    where schemaname='public' and (
      qual in ('(auth.uid() = user_id)','(auth.uid() = id)','(user_id = auth.uid())','(id = auth.uid())')
      or with_check in ('(auth.uid() = user_id)','(auth.uid() = id)','(user_id = auth.uid())','(id = auth.uid())')
    )
  loop
    v_sql := format('alter policy %I on public.%I',p.policyname,p.tablename);
    if p.qual in ('(auth.uid() = user_id)','(auth.uid() = id)','(user_id = auth.uid())','(id = auth.uid())') then
      v_sql := v_sql || format(' using (%s)',replace(p.qual,'auth.uid()','(select auth.uid())'));
    end if;
    if p.with_check in ('(auth.uid() = user_id)','(auth.uid() = id)','(user_id = auth.uid())','(id = auth.uid())') then
      v_sql := v_sql || format(' with check (%s)',replace(p.with_check,'auth.uid()','(select auth.uid())'));
    end if;
    execute v_sql;
  end loop;
end $$;
