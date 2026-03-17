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