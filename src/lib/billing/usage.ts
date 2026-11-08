import { AsyncLocalStorage } from 'node:async_hooks';
import { getDb } from '@/lib/db/client';

/** Where in the product an AI request came from. Users never see these; admins do. */
export type UsageStage = 'draft' | 'draft-revision' | 'generate' | 'revision' | 'caption' | 'other';

export interface UsageContext {
  userId?: string;
  projectId?: string;
  preset?: string;
  stage: UsageStage;
}

export interface UsageEntry {
  kind: 'chat' | 'image' | 'speech';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  characters?: number;
  durationMs: number;
  ok: boolean;
}

// AsyncLocalStorage follows awaits and promises started inside run(), including the
// background generation job, so the request that started the work stays attached to it.
const storage = new AsyncLocalStorage<UsageContext>();

export function runWithUsage<T>(context: UsageContext, fn: () => T): T {
  return storage.run(context, fn);
}

export const currentUsageContext = (): UsageContext | undefined => storage.getStore();

const count = (value: number | undefined) => (Number.isFinite(value) && value! > 0 ? Math.round(value!) : 0);

/**
 * Records one AI request. It never throws and never delays the caller: a missing or failing
 * database must not cost the user a video.
 */
export function recordUsage(entry: UsageEntry): void {
  const context = storage.getStore();
  try {
    void getDb()
      .run(
        `INSERT INTO ai_usage (id, created_at, user_id, project_id, preset, stage, kind, model,
           input_tokens, output_tokens, images, characters, duration_ms, ok)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          Date.now(),
          context?.userId ?? null,
          context?.projectId ?? null,
          context?.preset ?? null,
          context?.stage ?? 'other',
          entry.kind,
          entry.model.slice(0, 120) || 'unknown',
          count(entry.inputTokens),
          count(entry.outputTokens),
          count(entry.images),
          count(entry.characters),
          count(entry.durationMs),
          entry.ok ? 1 : 0,
        ]
      )
      .catch((error: unknown) => console.warn('[Usage] Could not record AI usage:', error));
  } catch (error) {
    console.warn('[Usage] Could not record AI usage:', error);
  }
}

/** Token counts from an OpenAI-compatible response body, whichever naming the router uses. */
export function usageFromBody(body: unknown): { inputTokens: number; outputTokens: number } {
  const usage = (body as { usage?: Record<string, unknown> } | null)?.usage ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) if (typeof usage[key] === 'number') return usage[key] as number;
    return 0;
  };
  return {
    inputTokens: pick('prompt_tokens', 'input_tokens'),
    outputTokens: pick('completion_tokens', 'output_tokens'),
  };
}
