/**
 * A/B test for the isometric canvas house style: the same object is written once with the
 * object prompt without the style and examples ("old") and once with them ("new"), each
 * rendered as the object sheet and scored once by the object critic.
 *
 * npx tsx --env-file=.env scripts/spike-iso-style.ts --objects kipas,mobil --out storage/spike/canvas-iso/style-ab
 */
import fs from 'fs';
import path from 'path';
import { callChat, parseCritique } from '@/lib/explainer/asset-generator';
import { assembleObjects, fitZoom, type FrameSize } from '@/lib/explainer/iso-canvas/assemble';
import { dryRunIsoCanvas } from '@/lib/explainer/iso-canvas/dry-run';
import type { IsoCanvasObject, IsoCanvasPlan } from '@/lib/explainer/iso-canvas/plan';
import { criticSystem, objectFunctionName, objectRequest, OBJECT_SYSTEM } from '@/lib/explainer/iso-canvas/prompts';
import { renderIsoSheet, withIsoBrowser } from '@/lib/explainer/iso-canvas/render';
import { writeUntilValid } from '@/lib/explainer/iso-canvas/writer';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const model = argument('model', process.env.DIRECTOR_MODEL || 'ag/gemini-3.8-flash-high');
// IDR per million tokens for ag/gemini-3.8-flash-high (model_rates, November 2026).
const RATE_IN = 13_597.5;
const RATE_OUT = 67_987.5;

const OLD_SYSTEM = OBJECT_SYSTEM.split('\n\nHOUSE STYLE')[0];

const OBJECTS: Record<string, { setting: string; object: IsoCanvasObject }> = {
  kipas: {
    setting: 'A home office: a wooden desk by a window with a desk fan on it.',
    object: { id: 'kipas', label: 'Kipas angin', look: 'A typical desk fan: round weighted base with buttons, an upright stand, a motor housing at the back, three or four blades inside a round wire guard, oscillating head.', size: [0.4, 0.3, 0.55], at: [0, 0, 0.75], states: [{ key: 'putar', meaning: '0 = blades still, 1 = blades spinning fast and the head oscillates' }] },
  },
  mobil: {
    setting: 'A city street with lanes, sidewalks, and trees.',
    object: { id: 'mobil', label: 'Mobil', look: 'A generic modern 4-door sedan: long low body, hood, windshield, cabin with side windows, trunk, four wheels with rims, headlights and tail lights, side mirrors. Painted red.', size: [4.5, 1.8, 1.45], at: [0, 0, 0], states: [{ key: 'lampu', meaning: '0 = lights off, 1 = headlights and tail lights on' }] },
  },
  hp: {
    setting: 'A bedside table at night with a phone charging on it.',
    object: { id: 'hp', label: 'HP', look: 'A modern smartphone lying flat, slim with rounded corners, a large screen with a thin bezel, a camera bump on the back, a charging cable plugged into the bottom.', size: [0.075, 0.16, 0.009], at: [0, 0, 0.6], states: [{ key: 'cas', meaning: '0 = screen off, 1 = screen on showing a charging battery icon that fills up' }] },
  },
};

const codeBlock = (text: string): string | null => /```(?:ts|typescript|js|javascript|tsx)?\s*\n([\s\S]*?)```/.exec(text)?.[1].trim() ?? null;

function probe(object: IsoCanvasObject, code: string) {
  const name = objectFunctionName(object.id);
  const state = Object.fromEntries(object.states.map((item) => [item.key, 1]));
  return {
    'IsoObjects.ts': assembleObjects([code]),
    'IsoWorld.ts': `import type { Iso, IsoStates } from '@/motion-kit';\nimport { ${name} } from './IsoObjects';\n\nexport function drawWorld(iso: Iso, t: number, states: IsoStates) {\n  iso.background('#F1F5F9', '#E2E8F0');\n  iso.ground('#E5E7EB');\n  ${name}(iso, states['${object.id}'] ?? {}, t);\n}\n`,
    'IsoScenes.ts': `import type { IsoSceneSpec } from '@/motion-kit';\n\nexport const scenes: IsoSceneSpec[] = [${JSON.stringify({ kind: 'world', start: 0, duration: 2, camera: [{ at: 0, look: [0, 0, object.size[2] / 2], zoom: 60 }], states: { [object.id]: state } })}];\n`,
  };
}

const preview = (object: IsoCanvasObject, frame: FrameSize) => `import React from 'react';
import { CanvasScene } from '@/motion-kit';
import { ${objectFunctionName(object.id)} } from './IsoObjects';

const keys: string[] = ${JSON.stringify(object.states.map((state) => state.key))};
const levels = [0, 1, 1, 0.5];

export default function Preview() {
  return (
    <CanvasScene
      draw={(iso, t) => {
        const step = Math.min(3, Math.floor(t + 0.001));
        const state: Record<string, number> = {};
        keys.forEach((key) => { state[key] = levels[step]; });
        iso.background('#F1F5F9', '#E2E8F0');
        iso.look(0, 0, ${object.size[2] / 2}, ${fitZoom(object.size, frame, 0.8)});
        iso.ground('#E2E8F0');
        ${objectFunctionName(object.id)}(iso, state, step * 0.4);
      }}
    />
  );
}
`;

async function main() {
  const out = path.resolve(argument('out', 'storage/spike/canvas-iso/style-ab'));
  fs.mkdirSync(out, { recursive: true });
  const frame: FrameSize = { width: 1080, height: 1920 };
  const ids = argument('objects', 'kipas,mobil').split(',');
  const variants = argument('variants', 'old,new').split(',') as Array<'old' | 'new'>;
  const runs = ids.flatMap((id) => variants.map((variant) => ({ id, variant })));
  await withIsoBrowser(async (browser) => {
    const results = await Promise.all(runs.map(async ({ id, variant }) => {
      const { setting, object } = OBJECTS[id];
      const plan = { setting, objects: [object] } as unknown as IsoCanvasPlan;
      const system = variant === 'old' ? OLD_SYSTEM : OBJECT_SYSTEM;
      let input = 0;
      let output = 0;
      const startedAt = Date.now();
      const written = await writeUntilValid({
        ask: async (feedback) => {
          const { text, usage } = await callChat({ model, system, content: objectRequest(plan, object) + feedback, maxTokens: 24_000 });
          input += usage.promptTokens;
          output += usage.completionTokens;
          return text;
        },
        parse: codeBlock,
        check: (code) => dryRunIsoCanvas(probe(object, code)).problems,
        show: (code) => `\`\`\`ts\n${code}\n\`\`\``,
      });
      if (!written.value || written.problems.length) return { id, variant, error: written.problems.slice(0, 3).join('; ') };
      fs.writeFileSync(path.join(out, `${id}-${variant}.ts`), written.value);
      const { sheet, still } = await renderIsoSheet(browser, { 'IsoObjects.ts': assembleObjects([written.value]), 'Preview.tsx': preview(object, frame) }, [0.2, 1.2, 2.2, 3.2], frame);
      fs.writeFileSync(path.join(out, `${id}-${variant}-sheet.jpg`), sheet);
      fs.writeFileSync(path.join(out, `${id}-${variant}-still.jpg`), still);
      const image = (buffer: Buffer) => ({ type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } });
      const critic = await callChat({ model, system: criticSystem('object'), maxTokens: 3_000, content: [{ type: 'text', text: `Setting: ${setting}\nObject: ${object.label}. ${object.look}\nFrames go from state 0 to every state at 1: ${object.states.map((state) => state.meaning).join('; ')}.` }, image(sheet), image(still)] });
      input += critic.usage.promptTokens;
      output += critic.usage.completionTokens;
      const review = parseCritique(critic.text);
      const lines = (written.value.match(/\biso\.\w+\(/g) ?? []).length;
      return { id, variant, score: review.average, scores: review.scores, issues: review.issues.slice(0, 4), calls: lines, seconds: Math.round((Date.now() - startedAt) / 1000), input, output, idr: Math.round((input * RATE_IN + output * RATE_OUT) / 1e6) };
    }));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    for (const result of results) console.log('RESULT', JSON.stringify(result));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
