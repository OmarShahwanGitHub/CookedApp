/**
 * Languages supported by all three recipe-parsing providers (Anthropic, OpenAI, Gemini).
 * English first (default); rest alphabetically by label.
 */
export const OUTPUT_LANGUAGES = [
  'English',
  'Arabic',
  'Chinese (Simplified)',
  'Dutch',
  'French',
  'German',
  'Hindi',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Polish',
  'Portuguese',
  'Russian',
  'Spanish',
  'Thai',
  'Turkish',
  'Vietnamese',
] as const;

export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage = 'English';
