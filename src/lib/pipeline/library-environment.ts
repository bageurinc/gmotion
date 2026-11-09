import { generateDraft, renderable } from '@/lib/assets/draft-ai';
import { layoutWorld } from '@/motion-kit/assets/world-layout';
import type { AssetPlan } from '@/lib/assets/plan-schema';
import type { AssetEntry } from '@/lib/assets/types';

/** A single AI-drawn ground layer follows the same camera as the library objects. */
export async function buildLibraryEnvironment(topic: string, plan: AssetPlan, registry: readonly AssetEntry[]) {
  const layout = layoutWorld(plan, registry);
  const slots = [...layout.origins].map(([id, origin]) => ({ id, x: origin.x + 380, y: origin.y + 300 }));
  if (!slots.length) throw new Error('Tidak ada posisi dunia untuk latar.');
  // Overscan keeps the terrain edge outside wide opening shots and close-up camera moves.
  const left = Math.min(...slots.map((slot) => slot.x)) - 1800;
  const top = Math.min(...slots.map((slot) => slot.y)) - 1800;
  const scale = Math.max(
    (Math.max(...slots.map((slot) => slot.x)) + 1800 - left) / 760,
    (Math.max(...slots.map((slot) => slot.y)) + 1800 - top) / 480,
  );
  const objects = slots.map((slot) => {
    const instance = plan.instances.find((item) => item.id === slot.id)!;
    return { ...slot, x: (slot.x - left) / scale, y: (slot.y - top) / scale, asset: instance.assetId, variant: instance.variant };
  });
  const result = await generateDraft({
    subject: 'Lingkungan cerita isometrik', label: 'Lingkungan cerita',
    notes: `This is a complete continuous WORLD BACKDROP for one video, not an isolated prop.
Topic: ${topic.slice(0, 1000)}
Narration: ${plan.scenes.map((scene) => scene.narration).join(' ').slice(0, 4000)}
Draw SVG manually with meaningful terrain, paths, vegetation, supporting buildings and small objects appropriate to this story. Fill the ENTIRE 760x480 canvas with terrain; never leave a plain white/empty background. Use restrained detail around the main objects. No text.
The library objects are rendered ON TOP at these screen coordinates on your canvas: ${JSON.stringify(objects)}.
Do not redraw those main assets. Integrate them with the environment. Connect relevant places with visible paths or pipes only when the story calls for that connection. The library renderer already extends river/canal water and banks beyond the camera along a down-right 30 degree axis. NEVER draw a second river, waterway or duplicate bank beneath or across it. Leave that diagonal corridor clear of supporting objects; draw the surrounding landscape instead. Place small supporting details near each listed object, within 250–600 world units (divide by the scale below for canvas pixels), so they remain visible in close-ups. Do not concentrate all details at the canvas edges. Draw extra supporting objects even when they are not explicitly named in the narration. Do not invent machinery or scientific mechanisms.
All details use the same 30 degree isometric projection and light direction. Scene object scale here is reduced by ${scale}; a library car is ${440 / scale} pixels long. Exactly one default variant; no state props.`,
  });
  if (!renderable(result.report)) throw new Error('Latar dunia buatan AI tidak lolos pemeriksaan.');
  return { code: result.code, placement: { x: left, y: top, scale } };
}
