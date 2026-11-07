'use client';

import React from 'react';
import { AbsoluteFill, Audio, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const FADE_FRAMES = 9;
const MUSIC_UNDER_VOICE = 0.13;
const MUSIC_BETWEEN_SCENES = 0.3;

/** Dips each scene through the video background so cuts feel like one film. */
export const SceneTransition: React.FC<React.PropsWithChildren<{ color: string; first: boolean }>> = ({
  children,
  color,
  first,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [first ? 1 : 0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ backgroundColor: color }}>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The preview serves these from the app, while renders read them from the bundle. */
const sharedAudio = (path: string) => (getRemotionEnvironment().isPlayer ? `/audio/${path}` : staticFile(`audio/${path}`));

/** Keeps music low under narration, lifting it briefly as scenes change. */
export function musicVolume(frame: number, sceneDurations: number[], fps: number): number {
  const total = sceneDurations.reduce((sum, duration) => sum + duration, 0);
  let boundary = 0;
  let lift = 0;
  for (const duration of sceneDurations) {
    boundary += duration;
    lift = Math.max(lift, 1 - Math.min(1, Math.abs(frame - boundary) / (fps * 0.45)));
  }
  const level = MUSIC_UNDER_VOICE + (MUSIC_BETWEEN_SCENES - MUSIC_UNDER_VOICE) * lift;
  const fade = Math.min(1, frame / fps, (total - frame) / (fps * 1.5));
  return Math.max(0, level * fade);
}

export const MusicBed: React.FC<{ track: string; sceneDurations: number[] }> = ({ track, sceneDurations }) => {
  const { fps } = useVideoConfig();
  if (track === 'none') return null;
  return (
    <Audio
      src={sharedAudio(`music/${track}.wav`)}
      loop
      volume={(frame) => musicVolume(frame, sceneDurations, fps)}
    />
  );
};

export const SceneSfx: React.FC<{ cue: string }> = ({ cue }) =>
  cue === 'none' ? null : <Audio src={sharedAudio(`sfx/${cue}.wav`)} volume={0.42} />;
