/**
 * Redraws an existing project's storyboard with another asset model and records real token usage.
 * The narration, storyboard, and critic stay the same, so only the drawing model changes.
 *
 * npx tsx --env-file=.env scripts/spike-model-cost.ts --from proj_x --drawing deepseek-flash
 */
import fs from 'fs';
import path from 'path';
import { assetModel } from '@/lib/explainer/scene-generator';
import { runGeneration, prepareGeneration } from '@/lib/pipeline/generation-job';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { DrawingModelSchema } from '@/types/studio';

interface Call {
  model: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  seconds: number;
  ok: boolean;
  status: number;
  requestChars: number;
  responseChars: number;
}

/** Dollars per 1M tokens from api-docs.deepseek.com/quick_start/pricing, read 2026-11-07. */
const PRICES: Record<string, { peak: Rate; offPeak: Rate }> = {
  'ds/deepseek-v4-pro': {
    peak: { hit: 0.044, miss: 1.32, output: 3.96 },
    offPeak: { hit: 0.022, miss: 0.66, output: 1.98 },
  },
  'ds/deepseek-v4.1-flash': {
    peak: { hit: 0.006, miss: 0.3, output: 1.2 },
    offPeak: { hit: 0.003, miss: 0.15, output: 0.6 },
  },
};

interface Rate {
  hit: number;
  miss: number;
  output: number;
}

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const cost = (calls: Call[], rate: Rate) =>
  calls.reduce(
    (sum, call) =>
      sum +
      ((call.promptTokens - call.cachedTokens) * rate.miss + call.cachedTokens * rate.hit + call.completionTokens * rate.output) / 1_000_000,
    0
  );

function recordCalls(calls: Call[], pending: Promise<void>[]) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const startedAt = Date.now();
    const response = await realFetch(input, init);
    if (!url.endsWith('/chat/completions') || !response.body) return response;

    const body = typeof init?.body === 'string' ? init.body : '';
    const model = body ? (JSON.parse(body) as { model?: string }).model ?? 'unknown' : 'unknown';
    const [forCaller, forLog] = response.body.tee();
    pending.push(
      (async () => {
        const text = await new Response(forLog).text();
        const call: Call = {
          model,
          promptTokens: 0,
          cachedTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          seconds: 0,
          ok: response.ok,
          status: response.status,
          requestChars: body.length,
          responseChars: 0,
        };
        for (const line of text.split('\n')) {
          if (!line.trim().startsWith('data:')) continue;
          try {
            const chunk = JSON.parse(line.trim().slice(5));
            const usage = chunk.usage;
            if (usage) {
              call.promptTokens = usage.prompt_tokens ?? call.promptTokens;
              call.completionTokens = usage.completion_tokens ?? call.completionTokens;
              call.cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? call.cachedTokens;
              call.reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? call.reasoningTokens;
            }
            call.responseChars += (chunk.choices?.[0]?.delta?.content ?? '').length;
          } catch {
            // Keep-alive lines carry no usage.
          }
        }
        call.seconds = Math.round((Date.now() - startedAt) / 1000);
        calls.push(call);
      })()
    );
    return new Response(forCaller, { status: response.status, headers: response.headers });
  };
}

async function main() {
  const from = arg('from');
  const drawingModel = DrawingModelSchema.parse(arg('drawing'));
  const model = assetModel(drawingModel);
  if (!from) throw new Error('--from is required');
  const source = getProject(from);
  if (!source) throw new Error(`Project ${from} not found`);

  const calls: Call[] = [];
  const pending: Promise<void>[] = [];
  recordCalls(calls, pending);

  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const draft = {
    ...source,
    id,
    drawingModel,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userPrompt: `${source.userPrompt} [uji ${model}]`,
    files: {},
    sceneAssets: undefined,
    sceneProgress: undefined,
    chatHistory: [],
    status: 'draft' as const,
  };
  saveProject(draft);

  const startedAt = Date.now();
  await runGeneration(prepareGeneration(draft));
  await Promise.all(pending);

  const finished = getProject(id);
  const drawing = calls.filter((call) => call.model === model);
  const others = calls.filter((call) => call.model !== model);
  const price = PRICES[model];
  const report = {
    id,
    model,
    seconds: Math.round((Date.now() - startedAt) / 1000),
    status: finished?.status,
    scenes: finished?.sceneProgress,
    drawing: {
      calls: drawing.length,
      failed: drawing.filter((call) => !call.ok).length,
      promptTokens: drawing.reduce((sum, call) => sum + call.promptTokens, 0),
      cachedTokens: drawing.reduce((sum, call) => sum + call.cachedTokens, 0),
      completionTokens: drawing.reduce((sum, call) => sum + call.completionTokens, 0),
      reasoningTokens: drawing.reduce((sum, call) => sum + call.reasoningTokens, 0),
      llmSeconds: drawing.reduce((sum, call) => sum + call.seconds, 0),
      peakUsd: price ? Number(cost(drawing, price.peak).toFixed(4)) : null,
      offPeakUsd: price ? Number(cost(drawing, price.offPeak).toFixed(4)) : null,
    },
    otherCalls: others,
    calls,
  };

  const output = path.join(process.cwd(), 'storage', 'spike', `model-cost-${id}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, otherCalls: others.length, calls: calls.length, output }, null, 2));
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
