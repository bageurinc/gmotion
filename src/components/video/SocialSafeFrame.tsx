import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { SafeOverlayHost, SafeAreaProvider } from '@/motion-kit/core/SafeOverlay';
import { getPreviewInsets, SocialPlatformOverlay, SocialPlatform } from './SocialPlatformOverlay';

export const SocialSafeFrame: React.FC<React.PropsWithChildren<{
  showGuides?: boolean;
  platform?: SocialPlatform;
  showSocialUI?: boolean;
}>> = ({ children, showGuides = false, platform = 'generic', showSocialUI = false }) => {
  const { width, height } = useVideoConfig();
  const insets = getPreviewInsets(width, height, platform);
  return (
    <SafeAreaProvider value={platform}>
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      <SafeOverlayHost>{children}</SafeOverlayHost>
      {showGuides && (
        <div aria-hidden style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 60,
          top: `${insets.top * 100}%`, right: `${insets.right * 100}%`,
          bottom: `${insets.bottom * 100}%`, left: `${insets.left * 100}%`,
          border: `${Math.max(2, width / 360)}px dashed #6ee7b7`,
          boxShadow: `0 0 0 ${Math.max(width, height)}px rgba(2, 6, 23, 0.25)`,
        }}>
          <span style={{ position: 'absolute', bottom: '100%', left: 0,
            color: '#6ee7b7', background: '#020617', padding: '6px 12px',
            fontSize: width / 40, fontFamily: 'sans-serif' }}>
            Area aman
          </span>
        </div>
      )}
      {showSocialUI && <SocialPlatformOverlay key={platform} platform={platform} width={width} height={height} />}
    </AbsoluteFill>
    </SafeAreaProvider>
  );
};
