'use client';

import React, { useMemo, useState } from 'react';
import { SocialSafeFrame } from '@/components/video/SocialSafeFrame';
import { SOCIAL_PLATFORMS, SocialPlatform } from '@/components/video/SocialPlatformOverlay';
import { Player } from '@remotion/player';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { StudioProject, AspectRatioDimensions } from '@/types/studio';

interface RemotionPreviewPlayerProps {
  project: StudioProject;
  activeSceneId?: string;
  platform?: SocialPlatform;
  onPlatformChange?: (platform: SocialPlatform) => void;
}

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  project,
  platform: controlledPlatform,
  onPlatformChange,
}) => {
  const [showGuides, setShowGuides] = useState(true);
  const [showSocialUI, setShowSocialUI] = useState(true);
  const [localPlatform, setPlatform] = useState<SocialPlatform>(project.safeAreaPlatform || 'tiktok');
  const platform = controlledPlatform || localPlatform;
  const { width, height } = AspectRatioDimensions[project.storyboard.aspectRatio] || {
    width: 1080,
    height: 1920,
  };
  const isPortrait = height > width;
  const previewPlatform = isPortrait ? platform : 'generic';

  const totalDurationInFrames = useMemo(() => {
    return project.storyboard.scenes.reduce(
      (acc, s) => acc + (s.durationInFrames || 120),
      0
    );
  }, [project.storyboard.scenes]);

  // Recompile virtual files into a React component whenever project.files changes
  const CompiledComponent = useMemo(() => {
    return compileVirtualProject(project.files, 'MainVideo.tsx');
  }, [project.files]);

  const SafeComponent = useMemo(() => {
    const Video: React.FC<{ showGuides: boolean; showSocialUI: boolean; platform: SocialPlatform }> = (props) => (
      <SocialSafeFrame {...props}>
        <CompiledComponent />
      </SocialSafeFrame>
    );
    return Video;
  }, [CompiledComponent]);
  const inputProps = useMemo(() => ({ showGuides, showSocialUI, platform: previewPlatform }), [showGuides, showSocialUI, previewPlatform]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 sm:p-4">
      <div role="group" aria-label="Platform pratinjau safe area" className="mb-3 flex flex-wrap justify-center gap-1.5">
        {SOCIAL_PLATFORMS.map(option => <button key={option.id} type="button"
          aria-pressed={previewPlatform === option.id}
          disabled={!isPortrait && option.id !== 'generic'}
          onClick={() => { setPlatform(option.id); onPlatformChange?.(option.id); }}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed ${previewPlatform === option.id ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
          {option.label}
        </button>)}
      </div>
      <div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
        <input type="checkbox" checked={showGuides}
          onChange={(event) => setShowGuides(event.target.checked)}
          className="accent-emerald-400" />
        Batas area aman
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
        <input type="checkbox" checked={showSocialUI}
          disabled={previewPlatform === 'generic'}
          onChange={event => setShowSocialUI(event.target.checked)} className="accent-emerald-400" />
        Tombol & caption sosmed
      </label>
      </div>
      {/* Player Canvas Container with Aspect Ratio Bounds */}
      <div
        className="relative shrink-0 rounded-xl overflow-hidden border border-slate-800 bg-slate-950"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, ${isPortrait ? 740 * width / height : 920}px, max(160px, calc((100dvh - 260px) * ${width / height})))`,
        }}
      >
        <Player
          component={SafeComponent}
          inputProps={inputProps}
          durationInFrames={Math.max(1, totalDurationInFrames)}
          compositionWidth={width}
          compositionHeight={height}
          fps={project.storyboard.fps || 30}
          style={{
            width: '100%',
            height: '100%',
          }}
          controls
          autoPlay
          loop
          showVolumeControls
        />
      </div>

      <p className="mt-3 max-w-sm text-center text-xs text-slate-300">
        Konten otomatis mengikuti area aman yang dipilih, termasuk saat ekspor MP4.{' '}
        Simulasi tombol, profil, dan caption sosmed hanya untuk pratinjau; tidak ikut diekspor.
        {isPortrait ? ' Tata letak aslinya dapat berbeda menurut perangkat dan aplikasi.' : ' Pilihan sosmed tersedia untuk video vertikal.'}
      </p>

      {/* Player Resolution & Duration Info Pill */}
      <div className="text-[11px] font-mono text-slate-400 flex flex-wrap justify-center items-center gap-2 mt-3 select-none">
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold">
          {project.storyboard.aspectRatio}
        </span>
        <span>{width}×{height}</span>
        <span>•</span>
        <span>{project.storyboard.fps || 30} FPS</span>
        <span>•</span>
        <span>
          {totalDurationInFrames} frames ({(totalDurationInFrames / (project.storyboard.fps || 30)).toFixed(1)}s)
        </span>
      </div>
    </div>
  );
};
