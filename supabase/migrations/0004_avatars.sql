-- ============================================================
-- MudahMengajar — 0004_avatars.sql
-- Bucket storage foto profil guru + RPC get_public_profile dengan avatar_url
-- ============================================================

-- Bucket publik agar foto bisa dilihat di halaman profil publik /guru/[id]
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policy storage.objects: baca publik, tulis hanya folder milik sendiri ({user_id}/...)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Perbarui RPC profil publik agar menyertakan avatar_url
create or replace function public.get_public_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_subjects jsonb;
  v_exp jsonb;
  v_ach jsonb;
begin
  select full_name, headline, bio, rate, career_start_year, address, whatsapp, avatar_url
    into v_profile
    from public.profiles
    where id = p_profile_id;
  if not found then
    raise exception 'Profil tidak ditemukan' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    into v_subjects
    from public.subjects
    where user_id = p_profile_id;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'institution', institution,
        'role', role,
        'start_year', start_year,
        'end_year', end_year,
        'description', description
      ) order by start_year desc), '[]'::jsonb)
    into v_exp
    from public.teaching_experiences
    where user_id = p_profile_id;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'title', title,
        'year', year,
        'description', description
      ) order by created_at desc), '[]'::jsonb)
    into v_ach
    from public.achievements
    where user_id = p_profile_id;

  return jsonb_build_object(
    'full_name', v_profile.full_name,
    'headline', v_profile.headline,
    'bio', v_profile.bio,
    'rate', v_profile.rate,
    'career_start_year', v_profile.career_start_year,
    'address', v_profile.address,
    'whatsapp', v_profile.whatsapp,
    'avatar_url', v_profile.avatar_url,
    'subjects', v_subjects,
    'experiences', v_exp,
    'achievements', v_ach
  );
end;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
