import { describe, expect, it, vi } from 'vitest';
import { chromiumOptionsFor } from './render-service';

describe('chromiumOptionsFor', () => {
  const project = (preset: 'story' | 'ads' | 'world' | 'story-2d' | 'ads-ui') => ({ storyboard: { preset } }) as never;

  it('leaves saved classic projects on the default renderer', () => {
    expect(chromiumOptionsFor(project('story-2d'))).toEqual({});
    expect(chromiumOptionsFor(project('ads-ui'))).toEqual({});
  });

  it('draws story and ads with WebGL', () => {
    expect(chromiumOptionsFor(project('story')).gl).toBeDefined();
    expect(chromiumOptionsFor(project('ads')).gl).toBeDefined();
  });

  it('lets RENDER_GL pick the WebGL renderer for world videos', () => {
    vi.stubEnv('RENDER_GL', 'swangle');
    expect(chromiumOptionsFor(project('world'))).toEqual({ gl: 'swangle' });
    vi.unstubAllEnvs();
  });

  it('always gives world videos a WebGL renderer', () => {
    expect(chromiumOptionsFor(project('world')).gl).toMatch(/angle/);
  });
});
