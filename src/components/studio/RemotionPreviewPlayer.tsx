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

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
      {/* Player Canvas Container with Aspect Ratio Bounds */}
      <div
        className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center"
        style={{
          aspectRatio: `${width} / ${height}`,
          maxHeight: 'calc(100vh - 160px)',
          maxWidth: '100%',
        }}
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
    </div>
  );
};
