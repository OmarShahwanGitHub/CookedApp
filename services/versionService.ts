import Constants from 'expo-constants';

const BACKEND_URL_ENV = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
const hostUri =
  Constants.expoConfig?.hostUri ??
  (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
  (Constants as any).manifest?.debuggerHost;

function getBackendBaseUrl(): string | null {
  if (BACKEND_URL_ENV && typeof BACKEND_URL_ENV === 'string' && BACKEND_URL_ENV.trim()) {
    return BACKEND_URL_ENV.trim().replace(/\/$/, '');
  }
  if (hostUri) {
    const protocol = String(hostUri).includes('exp.direct') ? 'https' : 'http';
    return `${protocol}://${hostUri}`;
  }
  return null;
}

/** Current app version from app.json (expo.version). */
export function getCurrentVersion(): string {
  const v =
    Constants.expoConfig?.version ??
    (Constants as any).manifest?.version ??
    '0.0.0';
  return String(v);
}

/** Parse "1.2.3" into [1,2,3] for comparison. */
function parseVersion(s: string): number[] {
  return s.split('.').map((n) => Math.max(0, parseInt(n, 10) || 0));
}

/** Returns: -1 if a < b, 0 if a === b, 1 if a > b. */
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const na = va[i] ?? 0;
    const nb = vb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** Fetches minimum required version from backend. Returns null if unavailable (allow app to run). */
export async function getMinRequiredVersion(): Promise<string | null> {
  const base = getBackendBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/app-version`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const min = data?.min_version;
    return typeof min === 'string' && min.length > 0 ? min : null;
  } catch {
    return null;
  }
}

/** True if the user must update before using the app. */
export async function isUpdateRequired(): Promise<boolean> {
  const min = await getMinRequiredVersion();
  if (!min) return false;
  const current = getCurrentVersion();
  return compareVersions(current, min) < 0;
}
