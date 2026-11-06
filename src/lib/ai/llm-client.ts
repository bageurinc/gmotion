import { createOpenAI } from '@ai-sdk/openai';

/**
 * OpenRouter & OpenAI-compatible client abstraction.
 * Allows switching base URL between:
 * - OpenRouter: https://openrouter.ai/api/v1
 * - OpenAI: https://api.openai.com/v1
 * - Any local LLM / vLLM / Ollama OpenAI-compatible gateway
 */
export function getOpenAIClient() {
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || '';

  return createOpenAI({
    baseURL,
    apiKey: apiKey || 'unconfigured-key',
  });
}

export function isApiKeyConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('your_api_key_here'));
}

export function getDirectorModel() {
  const client = getOpenAIClient();
  const modelName = process.env.DIRECTOR_MODEL || 'gpt-4o-mini';
  return client(modelName);
}

export function getCoderModel() {
  const client = getOpenAIClient();
  const modelName = process.env.CODER_MODEL || 'gpt-4o';
  return client(modelName);
}
