const express = require('express');
const path = require('path');
const cors = require('cors');
const { parseVideoToRecipe } = require('./parseVideo');
const { supabase } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || process.env.VIDEO_BACKEND_PORT || 3001;

function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return 'missing';
  if (secret.length < 10) return `${secret.slice(0, 2)}***`;
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

function getJwtRole(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.role || null;
  } catch {
    return null;
  }
}

app.use(cors());
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/promo/redeem') {
    console.log('[Promo] Incoming POST /promo/redeem (tcp received)', new Date().toISOString());
  }
  next();
});
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

/**
 * Last instant of access: end of UTC calendar day on (redeem UTC date + numDays + 1).
 * Example: redeem Thursday UTC with days=3 → access through end of Monday UTC.
 * (Matches “3-day” as the code’s day count plus the full redeem day and following span.)
 */
function entitlementExpiresEndOfLastDay(redeemDate, numDays) {
  const n = Math.max(1, Math.floor(Number(numDays)) || 3);
  const d = new Date(redeemDate);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day + n + 1, 23, 59, 59, 999));
}

// One-time promo codes (Supabase-backed)
app.post('/promo/redeem', async (req, res) => {
  const requestId = makeRequestId();
  try {
    console.info('[Promo] Redeem request received', {
      requestId,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    if (!supabase) {
      console.error('[Promo] Redeem unavailable: supabase client missing', { requestId });
      return res.status(503).json({ error: 'Promo service unavailable.', request_id: requestId });
    }

    const { code, user_id: userId } = req.body || {};
    if (!code || !userId) {
      return res.status(400).json({ error: 'code and user_id are required.', request_id: requestId });
    }
    const rawCode = String(code).trim();
    const normalizedCode = rawCode.toUpperCase();
    const codeCandidates = rawCode === normalizedCode ? [rawCode] : [rawCode, normalizedCode];
    console.info('[Promo] Redeem attempt', {
      requestId,
      userId,
      codeCandidates,
    });

    const { data: row, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .in('code', codeCandidates)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[Promo] Supabase fetch error:', { requestId, fetchError });
      return res.status(500).json({
        error: 'Promo lookup failed.',
        details: fetchError.message,
        code: fetchError.code,
        hint: fetchError.hint,
        request_id: requestId,
      });
    }

    if (!row) {
      return res.status(404).json({ error: 'Invalid code.', request_id: requestId });
    }

    if (row.redeemed_at) {
      return res.status(410).json({ error: 'Code already used.', request_id: requestId });
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
      console.error('[Promo] Supabase update error:', {
        requestId,
        rowId: row.id,
        code: row.code,
        updateError,
      });
      return res.status(500).json({
        error: 'Could not redeem code.',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint,
        request_id: requestId,
      });
    }

    console.info('[Promo] Redeem success', {
      requestId,
      rowId: row.id,
      userId,
      code: row.code,
      entitlement_expires_at: expires.toISOString(),
    });
    return res.json({ success: true, entitlement_expires_at: expires.toISOString() });
  } catch (err) {
    console.error('[Promo] Redeem error:', { requestId, err });
    return res.status(500).json({
      error: 'Failed to redeem promo code.',
      details: err?.message,
      request_id: requestId,
    });
  }
});

/**
 * Fix promo row user_id when the app switched stable ids (e.g. local_* → anon_* after SecureStore fix).
 * Requires proof: old_user_id must match the row. Does not extend expiry.
 */
app.post('/promo/migrate-user', async (req, res) => {
  const requestId = makeRequestId();
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Promo service unavailable.', request_id: requestId });
    }
    const { code, old_user_id: oldUserId, new_user_id: newUserId } = req.body || {};
    if (!code || !oldUserId || !newUserId) {
      return res.status(400).json({
        error: 'code, old_user_id, and new_user_id are required.',
        request_id: requestId,
      });
    }
    const raw = String(code).trim();
    const normalized = raw.toUpperCase();
    const codeCandidates = raw === normalized ? [raw] : [raw, normalized];

    const { data: row, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .in('code', codeCandidates)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[Promo] migrate-user fetch error:', { requestId, fetchError });
      return res.status(500).json({ error: 'Promo lookup failed.', request_id: requestId });
    }
    if (!row) {
      return res.status(404).json({ error: 'Invalid code.', request_id: requestId });
    }
    if (!row.redeemed_at) {
      return res.status(400).json({ error: 'Code not redeemed.', request_id: requestId });
    }
    if (row.user_id !== oldUserId) {
      return res.status(403).json({ error: 'Old user id does not match this promo.', request_id: requestId });
    }
    if (oldUserId === newUserId) {
      return res.json({ success: true, already: true, request_id: requestId });
    }
    const expires = row.entitlement_expires_at ? new Date(row.entitlement_expires_at) : null;
    if (!expires || Date.now() > expires.getTime()) {
      return res.status(410).json({ error: 'Promo access expired.', request_id: requestId });
    }

    const { error: updateError } = await supabase
      .from('promo_codes')
      .update({ user_id: newUserId })
      .eq('id', row.id);

    if (updateError) {
      console.error('[Promo] migrate-user update error:', { requestId, updateError });
      return res.status(500).json({ error: 'Could not update user.', request_id: requestId });
    }

    console.info('[Promo] migrate-user success', { requestId, rowId: row.id, from: oldUserId, to: newUserId });
    return res.json({ success: true, request_id: requestId });
  } catch (err) {
    console.error('[Promo] migrate-user error:', { requestId, err });
    return res.status(500).json({ error: 'Failed to migrate.', request_id: requestId });
  }
});

/** True if at least one promo row is still unredeemed (for hiding Promo UI). */
app.get('/promo/availability', async (req, res) => {
  const requestId = makeRequestId();
  try {
    if (!supabase) {
      return res.json({ available: false });
    }
    const { count, error } = await supabase
      .from('promo_codes')
      .select('id', { count: 'exact', head: true })
      .is('redeemed_at', null);

    if (error) {
      console.error('[Promo] Availability error:', { requestId, error });
      return res.json({ available: false });
    }
    const available = typeof count === 'number' && count > 0;
    return res.json({ available });
  } catch (err) {
    console.error('[Promo] Availability exception:', { requestId, err });
    return res.json({ available: false });
  }
});

app.get('/promo/entitlement', async (req, res) => {
  const requestId = makeRequestId();
  try {
    console.info('[Promo] Entitlement request received', {
      requestId,
      queryKeys: req.query ? Object.keys(req.query) : [],
    });

    if (!supabase) {
      console.warn('[Promo] Entitlement supabase missing', { requestId });
      return res.json({ active: false });
    }

    const userId = req.query.user_id;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'user_id is required.' });
    }
    console.info('[Promo] Entitlement lookup', { requestId, userId });

    const { data: row, error } = await supabase
      .from('promo_codes')
      .select('entitlement_expires_at')
      .eq('user_id', userId)
      .not('entitlement_expires_at', 'is', null)
      .order('entitlement_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Promo] Entitlement fetch error:', { requestId, error });
      return res.json({ active: false });
    }

    if (!row || !row.entitlement_expires_at) {
      return res.json({ active: false });
    }

    const now = new Date();
    const expires = new Date(row.entitlement_expires_at);
    const active = now.getTime() <= expires.getTime();
    console.info('[Promo] Entitlement result', {
      requestId,
      userId,
      entitlement_expires_at: row.entitlement_expires_at,
      active,
    });

    return res.json({ active, entitlement_expires_at: row.entitlement_expires_at });
  } catch (err) {
    console.error('[Promo] Entitlement error:', { requestId, err });
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
  console.log('[Promo] Server env check', {
    hasSupabaseClient: !!supabase,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    supabaseUrlHost: process.env.SUPABASE_URL ? String(process.env.SUPABASE_URL).replace(/^https?:\/\//, '') : null,
    serviceRolePreview: maskSecret(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceRoleClaim: getJwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY),
    nodeEnv: process.env.NODE_ENV || null,
  });
});
