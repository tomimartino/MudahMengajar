-- Teacher mutations and statistics are authenticated APIs; their ownership guards remain in place.
revoke all on function public.get_dashboard_stats() from public,anon;
grant execute on function public.get_dashboard_stats() to authenticated;
revoke all on function public.create_package(uuid,int,numeric,date) from public,anon;
grant execute on function public.create_package(uuid,int,numeric,date) to authenticated;
revoke all on function public.create_package(uuid,int,numeric,date,numeric) from public,anon;
grant execute on function public.create_package(uuid,int,numeric,date,numeric) to authenticated;
revoke all on function public.create_invoice(uuid,text,text,numeric,date) from public,anon;
grant execute on function public.create_invoice(uuid,text,text,numeric,date) to authenticated;

-- get_public_profile intentionally remains readable by visitors of /guru/[id].
