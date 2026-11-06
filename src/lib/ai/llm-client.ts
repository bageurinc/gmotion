import { createOpenAI } from '@ai-sdk/openai';

/**
 * OpenRouter & OpenAI-compatible client abstraction.
 * Explicitly uses `.chat(modelName)` so it connects to the standard
 * `/chat/completions` REST endpoint (compatible with OpenRouter, OpenAI, Groq, DeepSeek, etc.)
 * rather than the new experimental `/responses` endpoint which sends SSE event streams.
 */
export function getOpenAIClient() {
  const rawBaseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const baseURL = rawBaseURL.trim().replace(/\/+$/, '');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();

  return createOpenAI({
    baseURL,
    apiKey: apiKey || 'unconfigured-key',
    headers: {
      'HTTP-Referer': 'https://github.com/bageurinc/gmotion',
      'X-Title': 'gmotion Studio',
    },
  });
}

export function isApiKeyConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('your_api_key_here'));
}

export function getDirectorModel() {
  const client = getOpenAIClient();
  const modelName = process.env.DIRECTOR_MODEL || 'gpt-4o-mini';
  // MUST use .chat() for standard /chat/completions compatibility with OpenRouter
  return client.chat(modelName);
}

export function getCoderModel() {
  const client = getOpenAIClient();
  const modelName = process.env.CODER_MODEL || 'gpt-4o';
  // MUST use .chat() for standard /chat/completions compatibility with OpenRouter
  return client.chat(modelName);
}
