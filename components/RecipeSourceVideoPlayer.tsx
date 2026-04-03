import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, LayoutChangeEvent } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { setAudioModeAsync } from 'expo-audio';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Play } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { extractYouTubeVideoId, extractVimeoId, isLikelyDirectVideoUrl } from '@/utils/videoSource';

interface Props {
  sourceUrl: string;
}

/** YouTube Error 153 often happens when the embed request has no usable Referer; iframe + baseUrl + referrerpolicy fixes most WebView cases. */
function buildYouTubeEmbedHtml(videoId: string): string {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1`;
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<style>html,body{margin:0;padding:0;background:#000;height:100%;}iframe{border:0;}</style>
</head><body>
<iframe width="100%" height="100%" style="position:absolute;left:0;top:0;width:100%;height:100%"
  src="${src}"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body></html>`;
}

function buildVimeoEmbedHtml(vimeoId: string): string {
  const src = `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}`;
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<style>html,body{margin:0;padding:0;background:#000;height:100%;}iframe{border:0;}</style>
</head><body>
<iframe width="100%" height="100%" style="position:absolute;left:0;top:0;width:100%;height:100%"
  src="${src}"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body></html>`;
}

function DirectUrlVideo({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl, (p) => {
    p.loop = false;
  });
  return (
    <VideoView style={styles.directVideo} player={player} nativeControls contentFit="contain" />
  );
}

// Desktop Chrome UA — some hosts (including YouTube embed) behave better than the default WebView string.
const WEBVIEW_USER_AGENT =
  Platform.OS === 'android'
    ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export default function RecipeSourceVideoPlayer({ sourceUrl }: Props) {
  const [playerWidth, setPlayerWidth] = useState(0);
  const yt = extractYouTubeVideoId(sourceUrl);
  const vimeo = extractVimeoId(sourceUrl);
  const direct = isLikelyDirectVideoUrl(sourceUrl);

  const youtubeHtml = useMemo(() => (yt ? buildYouTubeEmbedHtml(yt) : ''), [yt]);
  const vimeoHtml = useMemo(() => (vimeo ? buildVimeoEmbedHtml(vimeo) : ''), [vimeo]);

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          allowsRecording: false,
          interruptionMode: 'duckOthers',
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setPlayerWidth(w);
  };

  const openInBrowser = () => {
    WebBrowser.openBrowserAsync(sourceUrl).catch(() => {});
  };

  const embedHeight = playerWidth > 0 ? Math.round((playerWidth * 9) / 16) : 200;

  const webViewCommon = {
    style: styles.webView,
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    javaScriptEnabled: true,
    domStorageEnabled: true,
    scrollEnabled: false,
    setSupportMultipleWindows: false,
    originWhitelist: ['https://*', 'http://*'],
    userAgent: WEBVIEW_USER_AGENT,
    sharedCookiesEnabled: true,
    ...(Platform.OS === 'android' ? { thirdPartyCookiesEnabled: true } : {}),
  } as const;

  if (yt) {
    return (
      <View style={styles.card} onLayout={onLayout}>
        <View style={[styles.embedShell, { height: embedHeight }]}>
          <WebView
            source={{ html: youtubeHtml, baseUrl: 'https://www.youtube-nocookie.com' }}
            {...webViewCommon}
          />
        </View>
        <TouchableOpacity style={styles.outlineButton} onPress={openInBrowser} hitSlop={8}>
          <ExternalLink size={16} color={Colors.primary} />
          <Text style={styles.outlineButtonText}>Open in browser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (vimeo) {
    return (
      <View style={styles.card} onLayout={onLayout}>
        <View style={[styles.embedShell, { height: embedHeight }]}>
          <WebView
            source={{ html: vimeoHtml, baseUrl: 'https://player.vimeo.com' }}
            {...webViewCommon}
          />
        </View>
        <TouchableOpacity style={styles.outlineButton} onPress={openInBrowser} hitSlop={8}>
          <ExternalLink size={16} color={Colors.primary} />
          <Text style={styles.outlineButtonText}>Open in browser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (direct) {
    return (
      <View style={styles.card}>
        <DirectUrlVideo sourceUrl={sourceUrl} />
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.outlineButton} onPress={openInBrowser} hitSlop={8}>
            <ExternalLink size={16} color={Colors.primary} />
            <Text style={styles.outlineButtonText}>Open original link</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.fallbackCard} onPress={openInBrowser} activeOpacity={0.85}>
        <View style={styles.fallbackIcon}>
          <Play size={28} color={Colors.primary} />
        </View>
        <Text style={styles.fallbackTitle}>Watch source video</Text>
        <Text style={styles.fallbackHint}>Opens TikTok, Instagram, Facebook, or other links in your browser.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 8,
  },
  embedShell: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  directVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  fallbackCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  fallbackIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  fallbackHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
