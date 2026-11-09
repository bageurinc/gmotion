import { describe, expect, it } from 'vitest';
import { applyTextStyle } from '@/lib/pipeline/text-style-change';
import { applyDraftUpdate } from '@/lib/pipeline/draft';
import { generateMainVideoCode } from '@/lib/pipeline/coder-agent';
import type { Storyboard, StudioProject } from '@/types/studio';

const scene = (n: number) => ({ id: `scene-${n}-narrative`, order: n, role: 'narrative', title: `A${n}`, voiceoverText: 'x', kineticHeadline: 'H', visualPrompt: 'v', cameraAction: 'static', sfxCue: 'none', durationInFrames: 90, wordTimings: [] });
const storyboard = {
  title: 'T', preset: 'story-2d', aspectRatio: '9:16', fps: 30, bgmTrack: 'none', textStyle: 'tegas',
  palette: { background: '#ffffff', surface: '#eeeeee', primary: '#112233', secondary: '#445566', alert: '#aa0000', text: '#111111' },
  scenes: [scene(1), scene(2), scene(3)],
} as unknown as Storyboard;

describe('applyTextStyle', () => {
  const project = {
    storyboard,
    files: {
      'Scene1.tsx': '<KineticHeadline text="A" textStyle="tegas" /><SyncedCaptions text="b" textStyle={"tegas"} />',
      'Scene3.tsx': '<SyncedCaptions text="simple scene without a style" />',
      'MainVideo.tsx': generateMainVideoCode(storyboard, [0, 2]),
    },
  } as unknown as StudioProject;

  it('rewrites every named style and passes the new one through MainVideo', () => {
    const next = applyTextStyle(project, 'editorial');
    expect(next.files['Scene1.tsx']).toBe('<KineticHeadline text="A" textStyle="editorial" /><SyncedCaptions text="b" textStyle="editorial" />');
    expect(next.files['Scene3.tsx']).toBe(project.files['Scene3.tsx']);
    expect(next.files['MainVideo.tsx']).toContain('<TextStyleProvider value="editorial">');
    expect(next.storyboard.textStyle).toBe('editorial');
  });

  it('keeps the scenes MainVideo already showed and remembers the original suggestion', () => {
    const next = applyTextStyle(project, 'ramah');
    expect(next.files['MainVideo.tsx']).toContain('import Scene3');
    expect(next.files['MainVideo.tsx']).not.toContain('import Scene2');
    expect(next.storyboard.textStyleSuggested).toBe('tegas');
    expect(applyTextStyle(next, 'teknis').storyboard.textStyleSuggested).toBe('tegas');
  });
});

describe('draft text style', () => {
  it('saves the chosen style and keeps the director suggestion', () => {
    const update = { title: 'T', textStyle: 'ramah' as const, scenes: storyboard.scenes.map(({ id, title, voiceoverText, kineticHeadline, visualPrompt }) => ({ id, title, voiceoverText, kineticHeadline, visualPrompt })) };
    const next = applyDraftUpdate(storyboard, update);
    expect(next.textStyle).toBe('ramah');
    expect(next.textStyleSuggested).toBe('tegas');
  });
});
