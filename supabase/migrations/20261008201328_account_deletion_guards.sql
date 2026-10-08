-- Deleted accounts must fail existing account guards even with an unexpired JWT.
create or replace function private.account_enabled(p_uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select p_uid is not null
    and exists(select 1 from public.profiles where id=p_uid)
    and not exists(select 1 from private.account_controls where user_id=p_uid and status='suspended');
$$;

-- This also guards Auth's cascade and prevents an administrator from removing
-- their profile directly through the Data API before deleting their Auth user.
create function private.protect_admin_profile_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.admin_members where user_id=old.id and active) then
    raise exception 'Lepas akses admin melalui pemilik website sebelum menghapus akun.' using errcode='42501';
  end if;
  return old;
end;
$$;
revoke all on function private.protect_admin_profile_deletion() from public,anon,authenticated;
create trigger protect_admin_profile_deletion
before delete on public.profiles
for each row execute function private.protect_admin_profile_deletion();
