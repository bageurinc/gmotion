'use client';

import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { StudioProject, AspectRatioDimensions } from '@/types/studio';

interface RemotionPreviewPlayerProps {
  project: StudioProject;
  activeSceneId?: string;
}

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  project,
}) => {
  const { width, height } = AspectRatioDimensions[project.storyboard.aspectRatio] || {
    width: 1080,
    height: 1920,
  };

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

  const isPortrait = height > width;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 sm:p-4">
      {/* Player Canvas Container with Aspect Ratio Bounds */}
      <div
        className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center transition-all"
        style={
          isPortrait
            ? {
                aspectRatio: `${width} / ${height}`,
                height: 'min(740px, calc(100vh - 160px))',
                minHeight: '380px',
                maxWidth: '100%',
              }
            : {
                aspectRatio: `${width} / ${height}`,
                width: 'min(920px, 94%)',
                minWidth: '320px',
                maxHeight: 'calc(100vh - 160px)',
              }
        }
      >
        <Player
          component={CompiledComponent}
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

      {/* Player Resolution & Duration Info Pill */}
      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-3 select-none">
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
