-- ============================================================
-- MudahMengajar — 0006_profile_learning_mode.sql
-- Metode belajar dipindah dari Pengaturan ke Profil guru,
-- agar orang tua/wali melihatnya di profil publik /guru/[id].
-- ============================================================

alter table public.profiles
  add column if not exists learning_mode text not null default 'offline'
    check (learning_mode in ('offline', 'online', 'hybrid'));

-- Salin nilai yang sudah diset guru di Pengaturan
update public.profiles p
   set learning_mode = s.default_learning_mode
  from public.settings s
 where s.user_id = p.id;

-- RPC profil publik menyertakan learning_mode
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
  select full_name, headline, bio, rate, career_start_year, address, whatsapp, avatar_url, learning_mode
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
    'learning_mode', v_profile.learning_mode,
    'subjects', v_subjects,
    'experiences', v_exp,
    'achievements', v_ach
  );
end;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
