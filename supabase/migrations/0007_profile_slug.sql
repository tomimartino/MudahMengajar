-- ============================================================
-- MudahMengajar — 0007_profile_slug.sql
-- Link profil kustom: /guru/<slug> selain /guru/<uuid>
-- ============================================================

alter table public.profiles
  add column if not exists slug text;

create unique index if not exists idx_profiles_slug
  on public.profiles (slug)
  where slug is not null;

-- RPC profil publik menerima slug atau id
drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(p_ident text)
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
  select id, full_name, headline, bio, rate, career_start_year, address, whatsapp, avatar_url, learning_mode
    into v_profile
    from public.profiles
    where id::text = lower(p_ident) or lower(slug) = lower(p_ident);
  if not found then
    raise exception 'Profil tidak ditemukan' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    into v_subjects
    from public.subjects
    where user_id = v_profile.id;

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
    where user_id = v_profile.id;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'title', title,
        'year', year,
        'description', description
      ) order by created_at desc), '[]'::jsonb)
    into v_ach
    from public.achievements
    where user_id = v_profile.id;

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

grant execute on function public.get_public_profile(text) to anon, authenticated;
