import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SocialSafeFrame } from '../src/components/video/SocialSafeFrame';
import { getSocialSafeInsets, SceneLayout, SceneBackground } from '../src/motion-kit/core/SafeOverlay';
import { SyncedCaptions } from '../src/motion-kit/core/SyncedCaptions';
import { CameraRig } from '../src/motion-kit/core/CameraRig';
import { SOCIAL_PLATFORMS, SocialPlatformOverlay } from '../src/components/video/SocialPlatformOverlay';

vi.mock('remotion', async (importOriginal) => ({
  ...await importOriginal<typeof import('remotion')>(),
  useVideoConfig: () => ({ width: 1080, height: 1920, fps: 30, durationInFrames: 150 }),
  useCurrentFrame: () => 90,
}));

describe('social safe frame', () => {
  it('keeps full-frame scenery outside the safe content grid and respects the scene background style', () => {
    const markup = renderToStaticMarkup(<SocialSafeFrame platform="tiktok">
      <SceneLayout style={{ backgroundColor: '#120B08' }}>
        <SceneBackground><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><circle cx="50" cy="50" r="40" /></svg></SceneBackground>
      </SceneLayout>
    </SocialSafeFrame>);
    expect(markup).toContain('background-color:#120B08');
    expect(markup).toContain('data-scene-background');
    const background = markup.slice(markup.indexOf('data-scene-background'), markup.indexOf('</svg>'));
    expect(background).toContain('inset:0');
    expect(background).toContain('width:100%');
    expect(background).not.toContain('bottom:25%');
    expect(background).not.toContain('transform:');
    expect(markup).toContain('bottom:25%');
  });

  it('contains camera zoom inside a protected scene instead of enlarging artwork past its stage', () => {
    const markup = renderToStaticMarkup(<SceneLayout><CameraRig fromScale={1.25} toScale={1.25} microDrift={false}>Art</CameraRig></SceneLayout>);
    expect(markup).toContain('translate(0%, 0%) scale(1)');
    expect(markup).not.toContain('scale(1.25)');
  });
  it.each(SOCIAL_PLATFORMS.filter(p => p.id !== 'generic'))('shows the $label interface only when explicitly enabled', ({ id }) => {
    const exported = renderToStaticMarkup(<SocialSafeFrame platform={id}>Video</SocialSafeFrame>);
    const preview = renderToStaticMarkup(<SocialSafeFrame platform={id} showSocialUI>Video</SocialSafeFrame>);
    expect(exported).not.toContain('data-social-preview');
    const nested = renderToStaticMarkup(<SocialSafeFrame platform={id}><SceneLayout>Video</SceneLayout></SocialSafeFrame>);
    const bottom = getSocialSafeInsets(1080, 1920, id).bottom * 100;
    // Both the frame host and nested scene host must use the selected platform,
    // even with all preview decorations disabled for export.
    expect(nested.match(new RegExp(`bottom:${bottom}%`, 'g'))).toHaveLength(2);
    expect(preview).toContain(`data-social-preview="${id}"`);
    expect(preview).toContain('@nama_akun');
    expect(preview).not.toContain('Area aman');
    if (id === 'shorts') {
      expect(preview).toContain('lucide-thumbs-up');
      expect(preview).toContain('Tidak suka');
      expect(preview).not.toContain('12,8 rb');
    }
  });

  it('omits vertical social UI on landscape video', () => {
    expect(renderToStaticMarkup(<SocialPlatformOverlay platform="tiktok" width={1920} height={1080} />)).toBe('');
  });

  it('keeps real spaces between caption words without enlarging the active word', () => {
    const html = renderToStaticMarkup(<SyncedCaptions
      text="lahir dari puncak berkabut seribu meter"
      wordTimings={[{ word: 'lahir', startMs: 0, endMs: 4000 }]}
    />);
    expect(html.replace(/<[^>]*>/g, '')).toBe('lahir dari puncak berkabut seribu meter');
    expect(html).not.toContain('transform:');
  });

  it.each([[1080, 1920], [1080, 1350], [1920, 1080], [1080, 1080]])(
    'reserves space for social controls at %sx%s',
    (width, height) => {
      const insets = getSocialSafeInsets(width, height);
      expect(insets.left + insets.right).toBeLessThan(1);
      expect(insets.top + insets.bottom).toBeLessThan(1);
      expect(insets.bottom).toBeGreaterThan(insets.top);
      expect(insets.right).toBeGreaterThanOrEqual(insets.left);
    },
  );

  it('omits preview guides from export and keeps backgrounds full frame', () => {
    const exported = renderToStaticMarkup(<SocialSafeFrame><div>Video</div></SocialSafeFrame>);
    const preview = renderToStaticMarkup(<SocialSafeFrame showGuides><div>Video</div></SocialSafeFrame>);
    expect(exported).not.toContain('Area aman');
    expect(preview).toContain('Area aman');
    expect(exported).not.toContain('transform:');
    expect(preview).not.toContain('transform:');
    expect(exported).toContain('data-safe-overlay');
    expect(exported).toContain('Video');
  });
});
