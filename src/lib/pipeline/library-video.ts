import { callChat } from '@/lib/explainer/asset-generator';
import { COPY_ANTI_SLOP_RULES } from '@/lib/pipeline/anti-slop';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { CoverageGapSchema, describeForPrompt, findAssets, PLAN_LIMITS, validateAssetPlan, type AssetPlan, type CoverageGap } from '@/lib/assets';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import { getPublishedVersions, loadAssetCatalog } from '@/lib/assets/published';
import { validateDraftCode } from '@/lib/assets/draft-contract';
import { recordAssetRequests } from '@/lib/assets/library-db';
import { generateProp, renderable } from '@/lib/assets/draft-ai';
import { DraftMetaSchema } from '@/lib/assets/draft-contract';
import { draftMetaToEntry } from '@/lib/assets/published';
import { searchAssets } from '@/lib/assets/semantic-search';
import { mergeRequestSubjects } from '@/lib/assets/request-merge';
import type { AssetEntry } from '@/lib/assets/types';
import type { LibraryReport, StudioProject } from '@/types/studio';

import { buildLibraryEnvironment } from './library-environment';

const MAX_ATTEMPTS = 3;

const SYSTEM = `You choose the visuals for a short vertical (9:16) explainer video in Bahasa Indonesia. The narration of every scene is already approved and fixed: never rewrite it. You may only use the registered assets in the catalog you are given.
Return one JSON object and nothing else:
{
  "schemaVersion": 1,
  "visualPolicy": "library-first",
  "unsupported": [{ "subject": "short Indonesian name", "kind": "object" | "action" | "environment", "reason": "why the catalog cannot show it", "sceneIds": ["ids of the scenes whose narration needs it"] }],
  "instances": [{ "id": "kebab-id", "assetId": "...", "assetVersion": "...", "variant": "...", "props": { } }],
  "scenes": [{
    "id": "the scene id given",
    "layout": "single" | "close-up" | "side-by-side" | "road",
    "durationSec": the duration given,
    "narration": "the narration given, unchanged",
    "instances": ["instance ids shown in this scene"],
    "set": [{ "instanceId": "...", "props": { } }],
    "focus": [{ "instanceId": "...", "anchor": "...", "label": "short Indonesian label, max 3 words" }],
    "actions": [{ "instanceId": "...", "prop": "...", "from": number, "to": number, "startSec": number, "endSec": number, "easing": "linear" | "ease-in-out" | "ease-out" }]
  }]
}
Rules:
- For water treatment, use separate environment.water-treatment instances with coagulation, sedimentation, filtration, or disinfection variants. Each is ONE modular basin. Connect their outlet/inlet anchors as needed. Never choose conventional for a new plan; it is only for old saved videos. Do not switch a single physical basin between different processes across scenes: place the required process units separately.
- When places are physically connected by a water supply, add optional top-level "connections": [{"from":{"instanceId":"...","anchor":"outlet"},"to":{"instanceId":"...","anchor":"waterInlet"}}]. Both endpoints must be real anchors in this catalog. Never connect a drain to a drinking-water inlet.
- For a house with a kitchen sink, reuse building.house in cutaway view with waterRunning and plumbingVisible true if those props exist. Focus on kitchenFaucet rather than adding a separate sink beside the house. A scene may include optional "camera":{"zoom":12} to move from the whole house into its actual faucet; use only for small details (range 1–16).
- One plan scene per given scene, same order, same id, same durationSec, same narration.
- Use only assetId, assetVersion, variant, prop names, and anchor names from the catalog. Props listed with "variants" work only on those variants. Actions may only target props marked animatable.
- Layouts: "single" and "close-up" take exactly 1 object; "side-by-side" takes exactly 2; "road" takes one road, 1-4 cars driving in the lanes, and up to 2 other objects (for example a traffic light) on the roadside. A road appears only in the road layout.
- To stop cars on a road, animate the road "distance" with easing "ease-out"; keep it constant while stopped, and animate it again to drive off. On a road, wheel spin follows the road. Props marked movesByItself (flow markers, energy dots) are moved by the renderer while their switch is on; never animate them.
- Every scene needs one visible change tied to its narration: open the hood when the engine is mentioned, fade a battery cover, change a state prop (for example a traffic light), or change the view with "set" (the shell fades smoothly). Spinning pulleys alone do not count. Time actions to when the narration reaches that part.
- At most 2 focus labels per scene, each on a part the narration of that scene talks about. Side-by-side already prints each car's name.
- At most ${PLAN_LIMITS.instances} instances. Respect the limitations in the catalog.
- If the narration of a scene talks about an object, action, or environment the catalog cannot show (check capabilities and limitations, not only names), list it in "unsupported" with the scene ids. Still plan those scenes with the closest relevant registered asset that does not contradict the narration (for example water flowing out of a treatment plant for "pipes to homes"), and never use an unrelated object to stand in for the missing one. Use an empty list when everything is covered.
${COPY_ANTI_SLOP_RULES}`;

export type LibraryBuild =
  | { used: true; files: Record<string, string>; report: LibraryReport }
  | { used: false; report: LibraryReport };

const sceneSeconds = (project: StudioProject, index: number) => {
  const scene = project.storyboard.scenes[index];
  return Math.max(1, (scene.durationInFrames || project.storyboard.fps * 3) / project.storyboard.fps);
};

/** Puts the approved narration and real durations back, whatever the model wrote. */
function lockToStoryboard(plan: AssetPlan, project: StudioProject): AssetPlan | string {
  const scenes = project.storyboard.scenes;
  if (plan.scenes.length !== scenes.length) return `The plan has ${plan.scenes.length} scenes; it must have exactly ${scenes.length}, one per given scene.`;
  return {
    ...plan,
    scenes: plan.scenes.map((scene, index) => {
      const duration = sceneSeconds(project, index);
      const factor = duration / scene.durationSec;
      return {
        ...scene,
        id: scenes[index].id.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || `scene-${index + 1}`,
        narration: scenes[index].voiceoverText.trim().slice(0, 400) || '…',
        durationSec: duration,
        actions: scene.actions.map((action) => ({ ...action, startSec: Math.min(duration - 0.1, action.startSec * factor), endSec: Math.min(duration, action.endSec * factor) })),
      };
    }),
  };
}

async function requestPlan(model: string, project: StudioProject, catalog: AssetEntry[], subset: unknown): Promise<{ plan: AssetPlan; attempts: number }> {
  const scenes = project.storyboard.scenes.map((scene, index) => ({
    id: scene.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || `scene-${index + 1}`,
    durationSec: Number(sceneSeconds(project, index).toFixed(2)),
    narration: scene.voiceoverText,
  }));
  let feedback = '';
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { text } = await callChat({
      model,
      system: SYSTEM,
      content: `Topic: "${project.userPrompt.slice(0, 1000)}"\nScenes: ${JSON.stringify(scenes)}\nCatalog: ${JSON.stringify(subset)}${feedback}`,
      maxTokens: 10_000,
    });
    const json = text.match(/\{[\s\S]*\}/);
    let parsed: unknown = null;
    try { parsed = json ? JSON.parse(json[0]) : null; } catch { /* reported below */ }
    const first = validateAssetPlan(parsed, catalog);
    let errors = first.ok ? [] : first.errors;
    if (first.ok) {
      const locked = lockToStoryboard(first.plan, project);
      if (typeof locked === 'string') errors = [locked];
      else {
        const final = validateAssetPlan(locked, catalog, { requireVisibleChange: true });
        if (final.ok) return { plan: final.plan, attempts: attempt };
        errors = final.errors;
      }
    }
    lastErrors = errors.length ? errors : ['Response was not a JSON plan'];
    feedback = `\n\nYour previous plan was rejected. Fix these errors and return the full corrected JSON:\n${lastErrors.slice(0, 20).join('\n')}\n\nPrevious plan:\n${json?.[0]?.slice(0, 12_000) ?? text.slice(0, 2000)}`;
  }
  throw new Error(`Rencana pustaka tidak valid setelah ${MAX_ATTEMPTS} percobaan: ${lastErrors.slice(0, 3).join('; ')}`);
}

/** The composition: the plan renderer, the published asset files it imports, and the music bed. */
export function libraryMainVideoCode(project: StudioProject, plan: AssetPlan, published: AssetEntry[], environment?: { x: number; y: number; scale: number }): string {
  const audio = project.storyboard.scenes.map((scene) => scene.audioUrl ?? null);
  const durations = project.storyboard.scenes.map((scene) => scene.durationInFrames);
  const data = { plan, audio, published, environment, music: project.storyboard.bgmTrack, durations };
  return `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { LIBRARY_ASSETS, MusicBed, WorldPlanVideo } from '@/motion-kit';
${environment ? "import Environment from './Environment';" : ''}
${published.map((_, index) => `import Asset${index + 1} from './Asset${index + 1}';`).join('\n')}

const data = ${JSON.stringify(data)};
const components = { ${published.map((entry, index) => `${JSON.stringify(`${entry.assetId}@${entry.version}`)}: Asset${index + 1}`).join(', ')} };
const registry = [...LIBRARY_ASSETS, ...(data.published as never[])];

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <WorldPlanVideo plan={data.plan as never} audio={data.audio} registry={registry} published={components}${environment ? ' environment={<g transform={`translate(${data.environment!.x} ${data.environment!.y}) scale(${data.environment!.scale})`}><svg width={760} height={480} viewBox="0 0 760 480"><Environment /></svg></g>}' : ''} />
    <MusicBed track={data.music} sceneDurations={data.durations} />
  </AbsoluteFill>
);

export default MainVideo;
`;
}

/**
 * Library-first for one isometric video: plan the approved narration with registered
 * assets. Falls back (used: false) when nothing in the library matches, or when the
 * narration needs something the library cannot show; those needs are logged for /admin/assets.
 */
export async function buildLibraryFiles(model: string, project: StudioProject): Promise<LibraryBuild> {
  const catalog = await loadAssetCatalog();
  const text = [project.userPrompt, ...project.storyboard.scenes.map((scene) => scene.voiceoverText)].join(' ');
  // Aliases plus meaning: "sedan listrik" finds the car even without that alias.
  const matches = await searchAssets(text, 'world', catalog);
  const empty = (fallbackReason: string, unsupported: CoverageGap[] = []): LibraryBuild => ({ used: false, report: { used: false, assets: [], unsupported, fallbackReason } });
  if (!matches.length) {
    // Topics with no matching asset are the clearest signal of what to build next, so their
    // needs are logged too. Logging never blocks the video: it falls back either way.
    const needs = await extractVisualNeeds(model, project).catch((error) => {
      console.error(`[Library] Need extraction failed for ${project.id}:`, error instanceof Error ? error.message : error);
      return [] as CoverageGap[];
    });
    const merged = await mergeRequestSubjects(needs, 'world', model);
    if (merged.length) await recordAssetRequests(merged, { preset: 'world', topic: project.userPrompt, userId: project.ownerId, projectId: project.id });
    return empty('Belum ada aset pustaka yang cocok dengan topik ini.', merged);
  }

  const ids = new Set(matches.map((match) => match.entry.assetId));
  const subset = describeForPrompt(matches);
  // A vehicle story usually needs somewhere to drive.
  if (ids.has('vehicle.car') && !ids.has('environment.road')) subset.push(...describeForPrompt(findAssets('jalan', 'world', catalog)));

  const first = await requestPlan(model, project, catalog, subset);
  let plan = first.plan;
  // Every gap of the first plan is real demand, logged once for /admin/assets.
  const demand = plan.unsupported.length ? await mergeRequestSubjects(plan.unsupported, 'world', model) : [];
  if (demand.length) await recordAssetRequests(demand, { preset: 'world', topic: project.userPrompt, userId: project.ownerId, projectId: project.id });

  // Hybrid: hard shapes come from the library; simple missing objects are drawn for this video
  // in the same projection, then the plan is made again with them in the catalog.
  const generated = await drawMissingProps(demand, project);
  let planCatalog = catalog;
  if (generated.length) {
    planCatalog = [...catalog, ...generated.map((item) => item.entry)];
    const extended = [...subset, ...describeForPrompt(generated.map((item) => ({ entry: item.entry, variants: [], matchedAliases: [] })))];
    try {
      plan = (await requestPlan(model, project, planCatalog, extended)).plan;
    } catch (error) {
      console.error(`[Library] Re-plan with drawn props failed for ${project.id}, keeping the first plan:`, error instanceof Error ? error.message : error);
    }
  }
  const gaps = plan === first.plan ? demand : plan.unsupported;
  if (gaps.length && affectedScenes(gaps, plan) > plan.scenes.length / 2) {
    return empty(`Lebih dari separuh adegan menyebut hal yang belum ada di pustaka: ${gaps.map((gap) => gap.subject).join(', ')}.`, gaps);
  }

  const codeKeys = new Set(ASSET_REGISTRY.map((entry) => `${entry.assetId}@${entry.version}`));
  const generatedByKey = new Map(generated.map((item) => [`${item.entry.assetId}@${item.entry.version}`, item]));
  const usedKeys = [...new Set(plan.instances.map((item) => `${item.assetId}@${item.assetVersion}`))];
  const wanted = usedKeys.filter((key) => !codeKeys.has(key) && !generatedByKey.has(key))
    .map((key) => ({ assetId: key.split('@')[0], version: key.split('@')[1] }));
  const published = await getPublishedVersions(wanted);
  if (published.length !== wanted.length) throw new Error('Aset terbit yang dipilih rencana tidak ditemukan.');
  const bundled = [
    ...published.map((item) => ({ entry: item.entry, code: item.code })),
    ...usedKeys.filter((key) => generatedByKey.has(key)).map((key) => generatedByKey.get(key)!),
  ];
  if (bundled.length > 99) throw new Error('Terlalu banyak aset dalam satu video.');

  const files: Record<string, string> = {};
  bundled.forEach((item, index) => {
    const errors = validateDraftCode(item.code);
    if (errors.length) throw new Error(`Aset ${item.entry.assetId}@${item.entry.version} tidak lolos validator: ${errors[0]}`);
    files[`Asset${index + 1}.tsx`] = item.code;
  });
  const environment = await buildLibraryEnvironment(project.userPrompt, plan, planCatalog);
  files['Environment.tsx'] = environment.code;
  const main = libraryMainVideoCode(project, plan, bundled.map((item) => item.entry), environment.placement);
  const validation = validateSceneCode(main, 'MainVideo.tsx');
  if (!validation.valid) throw new Error(`Kode video pustaka tidak valid: ${validation.errors.join('; ')}`);
  files['MainVideo.tsx'] = main;
  const drawn = usedKeys.filter((key) => generatedByKey.has(key)).map((key) => generatedByKey.get(key)!.entry.label);

  const assets = [...new Set(plan.instances.map((item) => `${item.assetId}@${item.assetVersion}`))];
  return { used: true, files, report: { used: true, assets: assets.filter((key) => !generatedByKey.has(key)), unsupported: gaps, ...(drawn.length ? { generated: drawn } : {}) } };
}

/**
 * Draft-time hint for library-first isometric projects: tells the Director which assets
 * exist as reusable building blocks without restricting the story to them. Returns
 * undefined when nothing in the library matches the prompt.
 */
export async function libraryDraftNote(prompt: string): Promise<string | undefined> {
  const catalog = await loadAssetCatalog();
  const matches = await searchAssets(prompt, 'world', catalog);
  if (!matches.length) return undefined;
  const ids = new Set(matches.map((match) => match.entry.assetId));
  const all = ids.has('vehicle.car') && !ids.has('environment.road') ? [...matches, ...findAssets('jalan', 'world', catalog)] : matches;
  const lines = all.map(({ entry, variants }) => {
    const shown = variants.length ? variants : Object.keys(entry.variants);
    const parts = shown.map((id) => `${entry.variants[id].label}: ${entry.variants[id].capabilities.join(', ')}${entry.variants[id].limitations.length ? ` (cannot: ${entry.variants[id].limitations.join('; ')})` : ''}`);
    return `- ${entry.label}: ${parts.join(' | ')}${entry.limitations.length ? `. Limits: ${entry.limitations.join('; ')}` : ''}`;
  });
  return `ASSET LIBRARY: reuse these assets when they fit the story. They are building blocks, not the boundary of the video. Write the full explanation the user needs, including objects and actions missing from this list. AI will draw missing objects and a continuous, detailed isometric environment with relevant supporting objects. Do not restrict the narration to catalog capabilities or substitute an unrelated asset for a missing subject.\n${lines.join('\n')}`;
}

const NEEDS_SYSTEM = `You list what an isometric explainer video must draw. Read the topic and narration and return only a JSON array of at most 6 items:
[{ "subject": "short Indonesian noun phrase, 1-3 words, singular, no brand", "kind": "object" | "action" | "environment" }]
Rules:
- Only the main things a viewer must see to understand the story: physical objects, places, and visible actions. Not abstract ideas, feelings, numbers, or text.
- Use the plainest common word (for example "orang", not "pejalan kaki" unless walking matters).
- Most important first. Return [] if nothing concrete must be drawn.`;

/** Asks the model for the main things a video must show, as asset requests. One small call. */
export async function extractVisualNeeds(model: string, project: StudioProject): Promise<CoverageGap[]> {
  const narration = project.storyboard.scenes.map((scene) => scene.voiceoverText).join(' ');
  const { text } = await callChat({
    model,
    system: NEEDS_SYSTEM,
    content: `Topic: "${project.userPrompt.slice(0, 1000)}"\nNarration: "${narration.slice(0, 4000)}"`,
    maxTokens: 800,
  });
  const json = text.match(/\[[\s\S]*\]/);
  if (!json) return [];
  let items: unknown;
  try { items = JSON.parse(json[0]); } catch { return []; }
  if (!Array.isArray(items)) return [];
  return items.slice(0, 6).flatMap((item) => {
    const parsed = CoverageGapSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** How many scenes the gaps touch. A gap without scene ids counts as one scene, to stay cautious. */
export function affectedScenes(gaps: readonly CoverageGap[], plan: AssetPlan): number {
  const ids = new Set(plan.scenes.map((scene) => scene.id));
  const touched = new Set<string>();
  let unknown = 0;
  for (const gap of gaps) {
    const known = (gap.sceneIds ?? []).filter((id) => ids.has(id));
    if (known.length) known.forEach((id) => touched.add(id));
    else unknown += 1;
  }
  return Math.min(plan.scenes.length, touched.size + unknown);
}

const MAX_DRAWN_PROPS = 3;

/**
 * Draws up to three simple missing objects in parallel for this video only. They are not
 * saved to the library; a failed or unsafe drawing is skipped, never shown.
 */
async function drawMissingProps(gaps: readonly CoverageGap[], project: StudioProject): Promise<Array<{ entry: AssetEntry; code: string }>> {
  const wanted = gaps.filter((gap) => gap.kind !== 'action').slice(0, MAX_DRAWN_PROPS);
  const drawn = await Promise.all(wanted.map(async (gap, index) => {
    try {
      const result = await generateProp({ subject: gap.subject, topic: project.userPrompt });
      const meta = DraftMetaSchema.safeParse(result.meta);
      if (!renderable(result.report) || !meta.success) return null;
      const slug = gap.subject.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 30) || `prop-${index + 1}`;
      const entry = draftMetaToEntry(meta.data, {
        id: `drawn-${slug}`, asset_id: `drawn.${slug}`, version: '0.0.0', draft_id: '', draft_version: 0,
        preset: 'world', status: 'active', published_by: null, published_at: 0,
      });
      const drawnEntry: AssetEntry = { ...entry, published: undefined, limitations: [...entry.limitations, 'Drawn by AI for this video only; not reviewed'] };
      return { entry: drawnEntry, code: result.code };
    } catch (error) {
      console.error(`[Library] Drawing "${gap.subject}" failed for ${project.id}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }));
  return drawn.filter((item): item is { entry: AssetEntry; code: string } => item !== null);
}
