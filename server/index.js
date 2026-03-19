const express = require('express');
const path = require('path');
const cors = require('cors');
const { parseVideoToRecipe } = require('./parseVideo');
const { supabase } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || process.env.VIDEO_BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// Lifetime recipe count per user_id (survives app reinstall when client sends same stable ID)
const recipeCountByUser = new Map();

app.get('/recipe-count', (req, res) => {
  const userId = req.query.user_id;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'user_id query is required.' });
  }
  const count = recipeCountByUser.get(userId) || 0;
  return res.json({ count });
});

app.post('/recipe-count', (req, res) => {
  const { user_id: userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'user_id in body is required.' });
  }
  const prev = recipeCountByUser.get(userId) || 0;
  const next = prev + 1;
  recipeCountByUser.set(userId, next);
  return res.json({ count: next });
});

app.post('/parse-video', async (req, res) => {
  const { url, output_language: outputLanguage } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid video URL is required.' });
  }

  try {
    const result = await parseVideoToRecipe(url.trim(), outputLanguage);
    return res.json(result);
  } catch (err) {
    console.error('Video parse error:', err);
    const message = err.message || 'Failed to process video.';
    const status = err.statusCode || 500;
    return res.status(status).json({ error: message });
  }
});

/** Last instant of access: end of UTC calendar day on the Nth day (day 1 = redeem day). */
function entitlementExpiresEndOfLastDay(redeemDate, numDays) {
  const n = Math.max(1, Math.floor(Number(numDays)) || 3);
  const d = new Date(redeemDate);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day + (n - 1), 23, 59, 59, 999));
}

// One-time promo codes (Supabase-backed)
app.post('/promo/redeem', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Promo service unavailable.' });
    }

    const { code, user_id: userId } = req.body || {};
    if (!code || !userId) {
      return res.status(400).json({ error: 'code and user_id are required.' });
    }

    const { data: row, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[Promo] Supabase fetch error:', fetchError);
      return res.status(500).json({ error: 'Promo lookup failed.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Invalid code.' });
    }

    if (row.redeemed_at) {
      return res.status(410).json({ error: 'Code already used.' });
    }

    const now = new Date();
    const days = row.days || 3;
    const expires = entitlementExpiresEndOfLastDay(now, days);

    const { error: updateError } = await supabase
      .from('promo_codes')
      .update({
        redeemed_at: now.toISOString(),
        user_id: userId,
        entitlement_expires_at: expires.toISOString(),
      })
      .eq('id', row.id);

    if (updateError) {
      console.error('[Promo] Supabase update error:', updateError);
      return res.status(500).json({ error: 'Could not redeem code.' });
    }

    return res.json({ success: true, entitlement_expires_at: expires.toISOString() });
  } catch (err) {
    console.error('[Promo] Redeem error:', err);
    return res.status(500).json({ error: 'Failed to redeem promo code.' });
  }
});

app.get('/promo/entitlement', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ active: false });
    }

    const userId = req.query.user_id;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'user_id is required.' });
    }

    const { data: row, error } = await supabase
      .from('promo_codes')
      .select('entitlement_expires_at')
      .eq('user_id', userId)
      .not('entitlement_expires_at', 'is', null)
      .order('entitlement_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Promo] Entitlement fetch error:', error);
      return res.json({ active: false });
    }

    if (!row || !row.entitlement_expires_at) {
      return res.json({ active: false });
    }

    const now = new Date();
    const expires = new Date(row.entitlement_expires_at);
    const active = now.getTime() <= expires.getTime();

    return res.json({ active, entitlement_expires_at: row.entitlement_expires_at });
  } catch (err) {
    console.error('[Promo] Entitlement error:', err);
    return res.json({ active: false });
  }
});

// Force-update: app checks this and blocks if installed version is below min.
// Set MIN_APP_VERSION when you release a breaking build (e.g. "1.1.0").
app.get('/app-version', (req, res) => {
  const min = process.env.MIN_APP_VERSION || '0.0.0';
  return res.json({ min_version: min });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Privacy and support pages (same deployment = more traffic, less spin-down)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video parser backend running on port ${PORT}`);
});
