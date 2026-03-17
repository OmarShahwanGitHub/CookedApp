const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn(
    '[Promo] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Promo code features will be disabled.'
  );
}

const supabase =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false },
      })
    : null;

module.exports = { supabase };

