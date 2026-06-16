import { config } from './env';

const PLACEHOLDER_KEY_PATTERNS = [
  /your-openai-api-key-here/i,
  /your-actual-openai-api-key/i,
  /replace-with/i,
  /sk-your/i,
  /example/i,
  /dummy/i,
  /test-key/i,
];

export function hasUsableOpenAiKey(rawKey?: string): boolean {
  const key = (rawKey ?? config.OPENAI_API_KEY ?? '').trim();
  if (!key) return false;

  const looksPlaceholder = PLACEHOLDER_KEY_PATTERNS.some((pattern) => pattern.test(key));
  if (looksPlaceholder) return false;

  return key.startsWith('sk-') && key.length > 20;
}
