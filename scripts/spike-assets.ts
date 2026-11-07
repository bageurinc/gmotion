import fs from 'fs';
import path from 'path';
import { bundleAsset, renderClip, renderContactSheet } from '../src/lib/explainer/asset-render';
import {
  AssetCritique,
  critiqueAsset,
  GeneratedAsset,
  generateAsset,
  LlmUsage,
  parseAssetResponse,
  repairAsset,
  reviseAsset,
} from '../src/lib/explainer/asset-generator';

const TOPICS: Record<string, string> = {
  jantung: 'Jelaskan cara kerja jantung memompa darah ke seluruh tubuh',
  jet: 'Jelaskan cara kerja mesin jet pesawat',
  eiffel: 'Ceritakan bagaimana Menara Eiffel dibangun dan bentuk strukturnya',
  air: 'Jelaskan siklus air di bumi dari laut sampai hujan',
  inflasi: 'Jelaskan apa itu inflasi dan kenapa harga barang naik',
  majapahit: 'Ceritakan puncak kejayaan Kerajaan Majapahit',
};

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const model = argument('model', 'ag/claude-opus-5-5-high');
const criticModel = argument('critic', 'ag/gemini-3.8-flash-high');
const topicIds = argument('topics', Object.keys(TOPICS).join(',')).split(',');
const maxRounds = Number(argument('rounds', '3'));
const concurrency = Number(argument('concurrency', '3'));
const passScore = Number(argument('pass', '8'));
const runId = argument('run', new Date().toISOString().replace(/[:.]/g, '-'));
const runDirectory = path.join(process.cwd(), 'storage', 'spike', runId);

class CriticFailure extends Error {}

interface RoundResult {
  round: number;
  directory: string;
  serveUrl: string;
  asset: GeneratedAsset;
  critique: AssetCritique;
}

async function critiqueWithRetry(prompt: string, asset: GeneratedAsset, sheet: Buffer) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await critiqueAsset(criticModel, prompt, asset, sheet);
    } catch (error) {
      if (attempt === 3) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CriticFailure(message);
      }
    }
  }
}

async function runTopic(topicId: string) {
  const prompt = TOPICS[topicId];
  if (!prompt) throw new Error(`Unknown topic ${topicId}`);
  const startedAt = Date.now();
  const usage: Array<LlmUsage & { step: string }> = [];
  const track = <T extends { usage: LlmUsage }>(step: string, result: T): T => {
    usage.push({ step, ...result.usage });
    return result;
  };
  const log = (message: string) => console.log(`[${topicId}] ${message}`);
  const rounds: RoundResult[] = [];
  const failures: string[] = [];
  let response = track('generate', await generateAsset(model, prompt));
  let repairsLeft = 2;

  for (let round = 1; round <= maxRounds; ) {
    const directory = path.join(runDirectory, topicId, `round-${round}`);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'response.txt'), response.text);
    try {
      const asset = parseAssetResponse(response.text);
      const serveUrl = await bundleAsset(asset, directory);
      const sheet = await renderContactSheet(serveUrl, directory);
      const { critique } = track('critique', await critiqueWithRetry(prompt, asset, sheet));
      fs.writeFileSync(path.join(directory, 'critique.json'), JSON.stringify(critique, null, 2));
      rounds.push({ round, directory, serveUrl, asset, critique });
      log(`round ${round}: score ${critique.average} ${JSON.stringify(critique.scores)}`);
      if (critique.average >= passScore || round === maxRounds) break;
      response = track('revise', await reviseAsset(model, prompt, asset, critique, sheet));
      round += 1;
    } catch (error) {
      if (error instanceof CriticFailure) throw error;
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`round ${round}: ${message.slice(0, 500)}`);
      log(`round ${round} failed: ${message.slice(0, 240)}`);
      if (repairsLeft === 0) {
        if (rounds.length) break;
        throw error;
      }
      repairsLeft -= 1;
      response = track('repair', await repairAsset(model, prompt, response.text, message));
    }
  }

  const best = [...rounds].sort((a, b) => b.critique.average - a.critique.average)[0];
  const clip = path.join(runDirectory, topicId, 'clip.mp4');
  await renderClip(best.serveUrl, clip);
  const summary = {
    topicId,
    prompt,
    model,
    criticModel,
    bestRound: best.round,
    scores: best.critique,
    roundScores: rounds.map((item) => ({ round: item.round, average: item.critique.average })),
    codeKilobytes: Math.round(Buffer.byteLength(best.asset.code) / 1024),
    minutes: Math.round((Date.now() - startedAt) / 6000) / 10,
    promptTokens: usage.reduce((sum, item) => sum + item.promptTokens, 0),
    completionTokens: usage.reduce((sum, item) => sum + item.completionTokens, 0),
    usage,
    failures,
  };
  fs.writeFileSync(path.join(runDirectory, topicId, 'result.json'), JSON.stringify(summary, null, 2));
  log(`done: score ${best.critique.average}, ${summary.minutes} min, clip ${clip}`);
  return summary;
}

async function main() {
  fs.mkdirSync(runDirectory, { recursive: true });
  const queue = [...topicIds];
  const settled: Array<{ topicId: string; error?: string; average?: number }> = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const topicId = queue.shift() as string;
        try {
          const summary = await runTopic(topicId);
          settled.push({ topicId, average: summary.scores.average });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${topicId}] failed: ${message.slice(0, 400)}`);
          settled.push({ topicId, error: message.slice(0, 400) });
        }
      }
    })
  );
  fs.writeFileSync(path.join(runDirectory, 'summary.json'), JSON.stringify(settled, null, 2));
  console.log(`RUN ${runId}\n${JSON.stringify(settled, null, 2)}`);
  process.exitCode = settled.some((item) => item.error) ? 1 : 0;
}

main();
