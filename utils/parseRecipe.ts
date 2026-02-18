import { ParsedRecipeData } from '@/types/recipe';
import { normalizeInputToText, InputType } from '@/services/inputNormalizer';
import { parseRecipeFromText as parseWithService, parseRecipeFromImages } from '@/services/recipeParser';
import Constants from 'expo-constants';

/** Error codes for video parse failures (shown in UI for debugging). */
export const VIDEO_PARSE_ERROR_CODES = {
  /** Request could not reach the backend (no network, wrong URL, CORS, etc.). */
  NETWORK: 'E_VIDEO_NETWORK',
  /** No video backend URL configured (prod: set EXPO_PUBLIC_VIDEO_BACKEND_URL). */
  NO_BACKEND: 'E_VIDEO_NO_BACKEND',
  /** Response was not valid JSON. */
  INVALID_RESPONSE: 'E_VIDEO_INVALID_RESPONSE',
  /** Server returned 4xx (e.g. bad request, unsupported URL). */
  SERVER_4XX: 'E_VIDEO_SERVER_4XX',
  /** Server returned 5xx (server error, timeout, crash). */
  SERVER_5XX: 'E_VIDEO_SERVER_5XX',
  /** Server returned error message (e.g. "Failed to process video"). */
  SERVER_ERROR: 'E_VIDEO_SERVER_ERROR',
} as const;

export type VideoParseErrorCode = (typeof VIDEO_PARSE_ERROR_CODES)[keyof typeof VIDEO_PARSE_ERROR_CODES];

function throwVideoError(message: string, code: VideoParseErrorCode): never {
  const err = new Error(`${message} (${code})`);
  (err as Error & { videoParseCode?: VideoParseErrorCode }).videoParseCode = code;
  throw err;
}

/** Get video parse error code from an error if present. */
export function getVideoParseErrorCode(error: unknown): VideoParseErrorCode | undefined {
  const e = error as Error & { videoParseCode?: VideoParseErrorCode };
  if (e?.videoParseCode) return e.videoParseCode;
  const match = e?.message?.match(/\((E_VIDEO_\w+)\)/);
  return (match?.[1] as VideoParseErrorCode) || undefined;
}

function getVideoBackendUrl(): string {
  const configured = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
  if (configured) return configured;

  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    // iOS blocks plain HTTP to remote hosts (ATS). Use HTTPS for Expo tunnel (*.exp.direct).
    const protocol = debuggerHost.includes('exp.direct') ? 'https' : 'http';
    return `${protocol}://${debuggerHost}`;
  }

  return 'http://localhost:8081';
}

/** Base URL for app-hosted pages (privacy, terms). Same as video backend in production. */
export function getBackendBaseUrl(): string {
  return getVideoBackendUrl();
}

export async function parseRecipe(
  input: string | string[],
  inputType: InputType
): Promise<ParsedRecipeData> {
  if (inputType === 'image') {
    const imageUris = Array.isArray(input) ? input : [input];
    return parseRecipeFromImages(imageUris);
  }

  if (inputType === 'video') {
    return parseVideoViaBackend(input as string);
  }

  const normalized = await normalizeInputToText(input, inputType);

  if (normalized.metadata?.isStub) {
    return {
      title: 'Recipe',
      description: normalized.text,
      ingredients: [],
      steps: [],
    };
  }

  return parseWithService(normalized.text);
}

async function parseVideoViaBackend(url: string): Promise<ParsedRecipeData> {
  const backendUrl = getVideoBackendUrl();
  const endpoint = `${backendUrl}/parse-video`;
  console.log('Video backend URL:', endpoint);

  if (!backendUrl || backendUrl.includes('localhost')) {
    throwVideoError(
      'No video backend configured. Set EXPO_PUBLIC_VIDEO_BACKEND_URL for production.',
      VIDEO_PARSE_ERROR_CODES.NO_BACKEND
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (e) {
    throwVideoError(
      `Request failed: ${e instanceof Error ? e.message : 'Network request failed'}`,
      VIDEO_PARSE_ERROR_CODES.NETWORK
    );
  }

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throwVideoError(
      'Server returned an unexpected response (not JSON).',
      VIDEO_PARSE_ERROR_CODES.INVALID_RESPONSE
    );
  }

  if (!response.ok) {
    const msg = data?.error || 'Failed to parse video.';
    if (response.status >= 500) {
      throwVideoError(msg, VIDEO_PARSE_ERROR_CODES.SERVER_5XX);
    }
    if (response.status >= 400) {
      throwVideoError(msg, VIDEO_PARSE_ERROR_CODES.SERVER_4XX);
    }
    throwVideoError(msg, VIDEO_PARSE_ERROR_CODES.SERVER_ERROR);
  }

  return data.recipe;
}

export { parseRecipeFromText } from '@/services/recipeParser';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
