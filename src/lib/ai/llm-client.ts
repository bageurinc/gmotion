import { createOpenAI } from '@ai-sdk/openai';
import { recordUsage, usageFromBody } from '@/lib/billing/usage';

/**
 * Parses raw Server-Sent Events (SSE) stream text (e.g. data: {"choices":...})
 * and reassembles it into a standard OpenAI /chat/completions JSON response.
 * This prevents SyntaxErrors when AI routers (such as 9router, OpenRouter, or custom proxies)
 * return an SSE event stream even when non-streaming response was requested.
 */
export function parseSSEStreamToChatCompletion(sseText: string): Record<string, unknown> {
  let content = '';
  let reasoningContent = '';
  let id = `chatcmpl-${Date.now()}`;
  let model = 'custom-model';
  let finishReason = 'stop';
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const lines = sseText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') continue;

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.id) id = parsed.id;
      if (parsed.model) model = parsed.model;
      if (parsed.usage) usage = parsed.usage;
      const choice = parsed.choices?.[0];
      if (choice?.delta?.content) {
        content += choice.delta.content;
      }
      if (choice?.delta?.reasoning_content) {
        reasoningContent += choice.delta.reasoning_content;
      }
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
    } catch {
      // Ignore partial malformed chunks
    }
  }

  // If content is empty but model put text in reasoning_content
  if (!content.trim() && reasoningContent.trim()) {
    content = reasoningContent;
  }

  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: finishReason,
      },
    ],
    usage,
  };
}

/**
 * Resilient fetch wrapper that:
 * 1. Explicitly forces stream: false in the request body.
 * 2. Catches any SSE event stream text from routers and reassembles it into standard JSON.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  const options = init ? { ...init } : {};
  const startedAt = Date.now();
  let model = 'unknown';

  // Force stream: false if sending JSON body
  if (options.body && typeof options.body === 'string') {
    try {
      const bodyObj = JSON.parse(options.body);
      if (typeof bodyObj.model === 'string') model = bodyObj.model;
      if (bodyObj.stream !== undefined) {
        bodyObj.stream = false;
      }
      options.body = JSON.stringify(bodyObj);
    } catch {
      // Ignore non-json body
    }
  }

  let response: Response;
  try {
    response = await fetch(input, options);
  } catch (error) {
    recordUsage({ kind: 'chat', model, durationMs: Date.now() - startedAt, ok: false });
    throw error;
  }

  // Read response text to inspect format
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const record = (body: unknown) =>
    recordUsage({ kind: 'chat', model, ...usageFromBody(body), durationMs: Date.now() - startedAt, ok: response.ok });

  // If upstream router returned SSE stream (starts with data: or event:)
  if (trimmed.startsWith('data:') || trimmed.startsWith('event:') || trimmed.includes('\ndata:')) {
    const chatCompletion = parseSSEStreamToChatCompletion(rawText);
    record(chatCompletion);
    return new Response(JSON.stringify(chatCompletion), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  }

  // Normal JSON or standard response
  let body: unknown = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    // Not JSON: the request still counts, without token numbers.
  }
  record(body);
  return new Response(rawText, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

/**
 * OpenRouter & OpenAI-compatible client abstraction.
 */
export function getOpenAIClient() {
  const rawBaseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const baseURL = rawBaseURL.trim().replace(/\/+$/, '');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();

  return createOpenAI({
    baseURL,
    apiKey: apiKey || 'unconfigured-key',
    fetch: resilientFetch,
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
  return client.chat(modelName);
}

export function getCoderModel() {
  const client = getOpenAIClient();
  const modelName = process.env.CODER_MODEL || 'gpt-4o';
  return client.chat(modelName);
}
