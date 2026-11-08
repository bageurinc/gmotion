import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { imageCameraAt } from '../../motion-kit/explainer/image-camera';
import { blankTopShare, IsoPicturePlan, IsoPicturePlanSchema, pictureFlows, pictureShots, worldImagePrompt } from './iso-picture';

const beat = (focus: string | null, label: string | null = null) => ({
  text: 'Kalimat', headline: 'Judul', accent: '', value: null, status: '', clock: null, focus, label, sticker: null,
});

const plan: IsoPicturePlan = {
  look: 'bright',
  unit: '%',
  palette: { ground: '#F4EFE6', hud: '#7A1F2B', hudText: '#FFFFFF', accent: '#22C3E6', ink: '#1F2421' },
  setting: 'A person upper body in isometric cutaway with the chest open, showing the heart between both lungs.',
  parts: [
    { id: 'jantung', label: 'Jantung', find: 'the red heart in the chest' },
    { id: 'paru', label: 'Paru-paru', find: 'the pink lungs' },
  ],
  details: [{ id: 'katup', label: 'Katup', draw: 'A close-up of a heart valve opening, cut open to show the flaps.' }],
  flows: [{ id: 'darah', through: ['jantung', 'paru'], activeBeats: [1] }],
  beats: [beat(null), beat('jantung', 'Pompa'), beat('katup'), beat('paru')],
};

describe('painted isometric world', () => {
  it('turns beats into part, close-up, and wide shots', () => {
    const boxes = { jantung: { x: 0.4, y: 0.5, w: 0.2, h: 0.15 }, paru: null };
    const shots = pictureShots(plan, boxes, [0, 60, 120, 180]);
    expect(shots[0]).toEqual({ from: 0, pose: 0, box: null, label: null });
    expect(shots[1]).toMatchObject({ pose: 0, box: boxes.jantung, label: 'Pompa' });
    expect(shots[2]).toMatchObject({ pose: 1, box: null, label: 'Katup' });
    // A part the vision model could not find falls back to the whole picture.
    expect(shots[3]).toMatchObject({ pose: 0, box: null, label: null });
  });

  it('runs a flow only through located parts and only in its beats', () => {
    const beats = [{ from: 0, duration: 60 }, { from: 60, duration: 90 }];
    const located = { jantung: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 }, paru: { x: 0.1, y: 0.4, w: 0.2, h: 0.2 } };
    expect(pictureFlows(plan, located, beats)).toEqual([{ points: [{ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.5 }], from: 60, to: 150 }]);
    expect(pictureFlows(plan, { ...located, paru: null }, beats)).toEqual([]);
  });

  it('asks for the subject in its real context without a base', () => {
    const prompt = worldImagePrompt(plan);
    expect(prompt).toContain(plan.setting);
    expect(prompt).toMatch(/No base, tile, plinth, platform/);
    expect(prompt).toMatch(/never digits/);
  });

  it('rejects a plan without parts', () => {
    expect(IsoPicturePlanSchema.safeParse({ ...plan, parts: [] }).success).toBe(false);
  });

  it('measures an empty strip only when it ends in a hard edge across the frame', async () => {
    const strip = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#EEEEEE' } })
      .composite([{ input: { create: { width: 90, height: 112, channels: 3, background: '#6B4A2E' } }, left: 0, top: 48 }])
      .png().toBuffer();
    expect(await blankTopShare(strip)).toBeCloseTo(0.3, 1);

    const subject = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#EEEEEE' } })
      .composite([{ input: { create: { width: 30, height: 112, channels: 3, background: '#C04040' } }, left: 30, top: 48 }])
      .png().toBuffer();
    expect(await blankTopShare(subject)).toBe(0);
  });

  it('pushes in during a held shot without jumping when the next shot starts', () => {
    const shots = [{ from: 0, pose: 0, box: null, label: null }, { from: 90, pose: 0, box: { x: 0.4, y: 0.5, w: 0.2, h: 0.1 }, label: null }];
    expect(imageCameraAt(60, shots, 30, 0.035).scale).toBeGreaterThan(imageCameraAt(0, shots, 30, 0.035).scale);
    const before = imageCameraAt(89, shots, 30, 0.035);
    const after = imageCameraAt(90, shots, 30, 0.035);
    expect(Math.abs(after.scale - before.scale)).toBeLessThan(0.01);
  });
});
