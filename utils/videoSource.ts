/** Extract YouTube video id from watch, shorts, or youtu.be URLs. */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  const shorts = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shorts) return shorts[1];
  const watch = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watch) return watch[1];
  const be = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (be) return be[1];
  return null;
}

export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}

/** Direct file / stream URLs suitable for expo-video. */
export function isLikelyDirectVideoUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|m3u8|mov|mkv)(\b|$)/i.test(path);
}

/** Pasted “link” imports that are really video hosting pages (show same inline player as video mode). */
export function isLikelyVideoHostingUrl(url: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    /(?:youtube\.com|youtu\.be)/.test(u) ||
    /vimeo\.com/.test(u) ||
    /(?:tiktok\.com|vm\.tiktok)/.test(u) ||
    /(?:instagram\.com|instagr\.am)/.test(u) ||
    /(?:facebook\.com|fb\.watch|fb\.reel)/.test(u)
  );
}
