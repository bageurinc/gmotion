import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSafeInsets } from '../core/SafeOverlay';

/** The beat fields the top panel reads. */
export interface PanelBeat {
  headline: string;
  accent: string;
  status: string;
  clock: string | null;
  value: number | null;
  from: number;
  duration: number;
}

export interface PanelPalette {
  hud: string;
  hudText: string;
  accent: string;
}

/**
 * What a panel design receives for the current scene. The engine decides the text and the
 * numbers (only numbers the story states), so a design only decides how they look.
 */
export interface PanelProps {
  headline: string;
  /** Word of the headline to emphasise, or null. */
  accent: string | null;
  status: string | null;
  clock: string | null;
  /** Null when the video states no numbers at all. */
  number: {
    /** False until the story states its first number; show nothing in the number spot until then. */
    reached: boolean;
    /** Counts up from the previous stated number during the first 1.4 s of a scene. */
    value: number;
    unit: string;
    /** Numbers stated so far, in order, for a trend line. */
    history: number[];
    /** Every number the video will state, to scale a trend line. */
    all: number[];
  } | null;
  /** Scene index from 0, and the number of scenes. */
  scene: number;
  scenes: number;
  /** Frames since this scene started. */
  since: number;
  /** Pixels from the top where text may start (below the platform's own controls). */
  safeTop: number;
  /** Pixels from the top the panel must end above, so the scene's subject stays visible. */
  maxBottom: number;
}

/** The panel may reach this share of the height; scene labels start just below it. */
export const PANEL_MAX_BOTTOM = 0.29;

export function panelAt(beats: PanelBeat[], unit: string, index: number, frame: number, fps: number, height: number, insetTop: number): PanelProps {
  const beat = beats[index];
  const numbers = beats.flatMap((item) => (item.value === null ? [] : [item.value]));
  const history = beats.slice(0, index + 1).flatMap((item) => (item.value === null ? [] : [item.value]));
  const reached = history.at(-1) ?? 0;
  const previous = beat.value === null ? reached : history.at(-2) ?? reached;
  const value = Math.round(
    interpolate(frame, [beat.from, beat.from + Math.min(beat.duration, fps * 1.4)], [previous, reached], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  return {
    headline: beat.headline,
    accent: beat.accent && beat.headline.includes(beat.accent) ? beat.accent : null,
    status: beat.status || null,
    clock: beat.clock,
    number: numbers.length ? { reached: history.length > 0, value, unit, history, all: numbers } : null,
    scene: index,
    scenes: beats.length,
    since: frame - beat.from,
    safeTop: height * Math.max(0.075, insetTop + 0.006),
    maxBottom: height * PANEL_MAX_BOTTOM,
  };
}

const FONT = '"Helvetica Neue", Arial, sans-serif';

/** The panel every world video had before designs: a solid band with a short fade below. */
export const DefaultPanel: React.FC<PanelProps & { palette: PanelPalette }> = ({ headline, accent, status, clock, number, safeTop, palette }) => {
  const { width, height } = useVideoConfig();
  const insets = useSafeInsets();
  const panelHeight = safeTop + height * (number ? 0.21 : 0.125);
  const chartWidth = width * 0.3;
  const top = number ? Math.max(...number.all, 1) : 1;
  const bottom = number ? Math.min(...number.all, 0) : 0;
  const points = (number?.history ?? [])
    .map((item, position) => {
      const x = (position / Math.max((number?.all.length ?? 1) - 1, 1)) * chartWidth;
      const y = 44 - ((item - bottom) / Math.max(top - bottom, 1)) * 40;
      return `${x},${y}`;
    })
    .join(' ');
  const [before, after] = accent ? headline.split(accent) : [headline, ''];

  return (
    <>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: panelHeight, background: palette.hud }} />
      <div style={{ position: 'absolute', top: panelHeight, left: 0, right: 0, height: height * 0.05, background: `linear-gradient(to bottom, ${palette.hud}, transparent)` }} />
      <div style={{ position: 'absolute', top: safeTop, left: width * Math.max(0.07, insets.left), right: width * Math.max(0.07, insets.right), fontFamily: FONT, color: palette.hudText }}>
        <div style={{ fontSize: width * 0.052, lineHeight: 1.16, fontWeight: 800, minHeight: width * 0.122 }}>
          {before}
          {accent && after !== undefined ? <span style={{ color: palette.accent }}>{accent}</span> : null}
          {after}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: height * 0.014 }}>
          {number ? (
            <>
              {/* Stays empty until the story states its first number, so nothing is invented. */}
              <div style={{ fontSize: width * 0.085, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1, minHeight: width * 0.085 }}>
                {number.reached && (
                  <>
                    {number.value}
                    <span style={{ fontSize: width * 0.036, marginLeft: 8 }}>{number.unit}</span>
                  </>
                )}
              </div>
              {new Set(number.all).size > 1 && (
                <svg width={chartWidth} height={48} style={{ overflow: 'visible' }}>
                  <polyline points={points} fill="none" stroke={palette.hudText} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </>
          ) : <div />}
          <div style={{ textAlign: 'right' }}>
            {status && (
              <div style={{ border: `2px solid ${palette.accent}`, color: palette.accent, borderRadius: 999, padding: '6px 16px', fontSize: width * 0.024, fontWeight: 700 }}>
                {status}
              </div>
            )}
            {clock && <div style={{ fontSize: width * 0.022, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{clock}</div>}
          </div>
        </div>
      </div>
    </>
  );
};

class PanelBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[Panel] The panel design failed; using the plain panel.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The top panel for the scene playing now. A model-written design renders it; if it throws,
 * the plain panel takes over for the rest of the video.
 */
export const PanelTrack: React.FC<{ beats: PanelBeat[]; unit: string; palette: PanelPalette; Panel?: React.FC<PanelProps> }> = ({ beats, unit, palette, Panel }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const insets = useSafeInsets();
  if (!beats.length) return null;
  const index = Math.max(0, beats.findLastIndex((beat) => frame >= beat.from));
  const props = panelAt(beats, unit, index, frame, fps, height, insets.top);
  const plain = <DefaultPanel {...props} palette={palette} />;
  return Panel ? <PanelBoundary fallback={plain}><Panel {...props} /></PanelBoundary> : plain;
};
