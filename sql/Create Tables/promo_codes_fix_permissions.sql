-- Fix: "permission denied for table promo_codes" (Postgres 42501) when using the service role from Render.
-- RLS policies alone are not enough if service_role has no table privileges.
-- Run this once in Supabase → SQL Editor (safe to re-run).

grant usage on schema public to service_role;

grant select, insert, update on table public.promo_codes to service_role;
