create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  kind text not null default 'days', -- currently only 'days'
  days integer not null default 3,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  user_id text,
  entitlement_expires_at timestamptz
);

create index promo_codes_code_idx on promo_codes (code);
create index promo_codes_user_idx on promo_codes (user_id);

---------------------------------------------
-- Enable row level security
---------------------------------------------
alter table promo_codes enable row level security;

-- Backend server should use SUPABASE_SERVICE_ROLE_KEY.
-- Allow only service_role to access promo codes.
create policy promo_codes_service_role_select
  on promo_codes
  for select
  to service_role
  using (true);

create policy promo_codes_service_role_insert
  on promo_codes
  for insert
  to service_role
  with check (true);

create policy promo_codes_service_role_update
  on promo_codes
  for update
  to service_role
  using (true)
  with check (true);