export type InputType = 'text' | 'url' | 'image' | 'video';

export interface NormalizedInput {
  text: string;
  sourceType: InputType;
  metadata?: {
    originalUrl?: string;
    imageCount?: number;
    isStub?: boolean;
  };
}

export async function normalizeInputToText(
  input: string | string[],
  type: InputType
): Promise<NormalizedInput> {
  switch (type) {
    case 'text':
      return normalizeText(input as string);
    case 'url':
      return normalizeUrl(input as string);
    case 'image':
      return normalizeImages(Array.isArray(input) ? input : [input as string]);
    case 'video':
      return normalizeVideo(input as string);
    default:
      throw new Error(`Unsupported input type: ${type}`);
  }
}

function normalizeText(text: string): NormalizedInput {
  return {
    text: text.trim(),
    sourceType: 'text',
  };
}

async function normalizeUrl(url: string): Promise<NormalizedInput> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CookedApp/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const text = stripHtmlToText(html);

    return {
      text,
      sourceType: 'url',
      metadata: { originalUrl: url },
    };
  } catch (error) {
    console.warn('URL fetch failed, returning URL as context:', error);
    return {
      text: `Recipe from URL: ${url}\n\nUnable to fetch content automatically. Please paste the recipe text manually.`,
      sourceType: 'url',
      metadata: { originalUrl: url, isStub: true },
    };
  }
}

function stripHtmlToText(html: string): string {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');

  text = text.replace(/<[^>]+>/g, '');

  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&frac12;/gi, '1/2');
  text = text.replace(/&frac14;/gi, '1/4');
  text = text.replace(/&frac34;/gi, '3/4');

  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  return lines.join('\n');
}

async function normalizeImages(imageUris: string[]): Promise<NormalizedInput> {
  const ocrText = await extractTextFromImages(imageUris);

  return {
    text: ocrText,
    sourceType: 'image',
    metadata: { imageCount: imageUris.length },
  };
}

async function extractTextFromImages(imageUris: string[]): Promise<string> {
  console.log(`OCR requested for ${imageUris.length} image(s) — using stub implementation`);
  return [
    `[Image-based recipe input — ${imageUris.length} image(s) provided]`,
    '',
    'OCR processing is not yet configured.',
    'To enable image-to-text extraction:',
    '1. Set the OCR_API_KEY environment variable',
    '2. Configure the OCR provider in services/ocrProvider.ts',
    '',
    'For now, please paste the recipe text manually.',
  ].join('\n');
}

async function normalizeVideo(url: string): Promise<NormalizedInput> {
  console.log('Video transcription requested — using stub implementation');
  return {
    text: [
      `[Video recipe input — URL: ${url}]`,
      '',
      'Video transcription is coming soon.',
      'To enable video-to-text extraction:',
      '1. Set the TRANSCRIPTION_API_KEY environment variable',
      '2. Configure the transcription provider in services/transcriptionProvider.ts',
      '',
      'For now, please paste the recipe text manually.',
    ].join('\n'),
    sourceType: 'video',
    metadata: { originalUrl: url, isStub: true },
  };
}
