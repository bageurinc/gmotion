import { describe, expect, it } from 'vitest';
import { generationPercent } from '@/lib/studio-progress';
import type { StudioProject } from '@/types/studio';

const scenes = [{ id: 'a' }, { id: 'b' }];
const project = (changes: Partial<StudioProject>, preset = 'story-svg') =>
  ({ status: 'generating', storyboard: { preset, scenes }, sceneProgress: {}, ...changes }) as unknown as StudioProject;

describe('generationPercent', () => {
  it('fills the first 30% while the object draft is drawn', () => {
    expect(generationPercent(project({ storySvgDraftProgress: { percent: 50, label: 'x' } }))).toBe(15);
    expect(generationPercent(project({ storySvgDraft: {} as never, storySvgReviewPending: true, status: 'idle' }))).toBe(30);
  });

  it('moves with scene stages after the draft and holds below 100 during final checks', () => {
    const drawing = project({ storySvgDraft: {} as never, sceneProgress: { a: { stage: 'ready' }, b: { stage: 'animation' } } });
    expect(generationPercent(drawing)).toBe(Math.round(30 + 70 * (1.45 / 2)));
    const checking = project({ storySvgDraft: {} as never, sceneProgress: { a: { stage: 'ready' }, b: { stage: 'ready' } } });
    expect(generationPercent(checking)).toBe(97);
    expect(generationPercent({ ...checking, status: 'ready' })).toBe(100);
  });

  it('gives other styles the whole bar for scenes', () => {
    expect(generationPercent(project({ sceneProgress: { a: { stage: 'ready' } } }, 'story-2d'))).toBe(50);
  });
});
