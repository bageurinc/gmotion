import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useSafeInsets } from '../core/SafeOverlay';
import type { WordTiming } from '../../types/studio';

/** Words per caption group; a new group replaces the old one when its first word is spoken. */
export const CAPTION_GROUP = 5;

export interface CaptionWord {
  text: string;
  state: 'past' | 'active' | 'future';
  /** Frames since this word started being spoken; negative while it is still ahead. */
  since: number;
}

/**
 * What a caption design receives: the words on screen now and timing in frames. Grouping,
 * timing, and the safe area are the engine's job, so a design only decides how words look.
 */
export interface CaptionProps {
  words: CaptionWord[];
  /** Frames since this group of words appeared. */
  since: number;
  /** Position of this group within the scene, from 0. */
  group: number;
}

export type CaptionPalette = { ink: string };

/** The plain caption every video had before designs: a white pill, active word inverted. */
export const DefaultCaption: React.FC<CaptionProps & { palette: CaptionPalette }> = ({ words, palette }) => {
  const { width } = useVideoConfig();
  return (
    <div style={{ background: '#FFFFFF', color: palette.ink, borderRadius: 18, padding: '10px 18px', fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: width * 0.04, fontWeight: 800, textAlign: 'center', lineHeight: 1.3, boxShadow: `0 3px 0 ${palette.ink}55` }}>
      {words.map((word, position) => {
        const isActive = word.state === 'active';
        return (
          <React.Fragment key={position}>
            <span style={{ padding: '2px 6px', borderRadius: 8, background: isActive ? palette.ink : 'transparent', color: isActive ? '#FFFFFF' : palette.ink }}>{word.text}</span>{' '}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Turns a scene's word timings into the group and word states shown at this frame. */
export function captionAt(wordTimings: WordTiming[], frameInScene: number, fps: number): CaptionProps | null {
  if (!wordTimings.length) return null;
  const toFrames = (ms: number) => (ms / 1000) * fps;
  const timeMs = (frameInScene / fps) * 1000;
  const current = Math.max(0, wordTimings.findLastIndex((word) => timeMs >= word.startMs));
  const start = Math.floor(current / CAPTION_GROUP) * CAPTION_GROUP;
  const group = wordTimings.slice(start, start + CAPTION_GROUP);
  return {
    group: start / CAPTION_GROUP,
    since: Math.max(0, frameInScene - (start === 0 ? 0 : toFrames(wordTimings[start].startMs))),
    words: group.map((word, position) => ({
      text: word.word,
      state: start + position < current ? 'past' : start + position === current ? 'active' : 'future',
      since: frameInScene - toFrames(word.startMs),
    })),
  };
}

class CaptionBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[Caption] The caption design failed; using the plain caption.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Captions for one scene, inside the platform safe area at the bottom. A model-written design
 * renders the words; if it throws, the plain pill takes over for the rest of the video.
 */
export const CaptionTrack: React.FC<{
  beat: { from: number; wordTimings: WordTiming[] };
  palette: CaptionPalette;
  Caption?: React.FC<CaptionProps>;
}> = ({ beat, palette, Caption }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const insets = useSafeInsets();
  const props = captionAt(beat.wordTimings, frame - beat.from, fps);
  if (!props) return null;
  const plain = <DefaultCaption {...props} palette={palette} />;
  return (
    <div style={{ position: 'absolute', left: width * insets.left, right: width * insets.right, bottom: height * insets.bottom, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      {Caption ? <CaptionBoundary fallback={plain}><Caption {...props} /></CaptionBoundary> : plain}
    </div>
  );
};
