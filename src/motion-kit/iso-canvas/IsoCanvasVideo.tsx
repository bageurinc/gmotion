'use client';

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { WorldOverlay, type WorldVideoProps } from '../world/WorldStage';
import { CanvasScene } from './CanvasScene';
import { paintIsoScene, type IsoSceneSpec, type IsoWorldDraw } from './scenes';
import { TitleBoundary } from './title-kit';
import type { CaptionProps } from '../world/caption-track';
import type { PanelProps } from '../world/panel-track';

/** The overlay panel ends near 30% of the height at most, so labels start below it. */
const LABEL_TOP = 0.31;

/**
 * An isometric canvas video: each scene paints the shared world (or its own close-up) on a
 * canvas, under the same panel, captions, audio, and music overlay as the other world videos.
 */
export const IsoCanvasVideo: React.FC<{
  scenes: IsoSceneSpec[];
  drawWorld: IsoWorldDraw;
  script: WorldVideoProps['script'];
  /** Opening title card written for this video; the headline panel waits until it ends. */
  title?: React.FC<{ duration: number }>;
  titleFrames?: number;
  /** Caption design written for this video; the engine still times and places the words. */
  caption?: React.FC<CaptionProps>;
  /** Top panel design written for this video; the engine still decides its text and numbers. */
  panel?: React.FC<PanelProps>;
}> = ({ scenes, drawWorld, script, title: Title, titleFrames = 0, caption, panel }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      {scenes.map((scene, index) => {
        const from = Math.round(scene.start * fps);
        const next = scenes[index + 1];
        // Frames are counted from the next scene's start so rounding never leaves a gap.
        const duration = Math.max(1, (next ? Math.round(next.start * fps) : from + Math.round(scene.duration * fps)) - from);
        return (
          <Sequence key={index} from={from} durationInFrames={duration} layout="none">
            <CanvasScene draw={(iso, t) => paintIsoScene(iso, scene, t, drawWorld)} labelTop={LABEL_TOP} />
          </Sequence>
        );
      })}
      {Title && titleFrames > 0 && (
        <Sequence from={0} durationInFrames={titleFrames} layout="none">
          <TitleBoundary>
            <Title duration={titleFrames} />
          </TitleBoundary>
        </Sequence>
      )}
      <WorldOverlay script={script} hudFrom={Title ? titleFrames : 0} caption={caption} panel={panel} />
    </AbsoluteFill>
  );
};
