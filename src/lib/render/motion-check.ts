/** Frames each scene spends fading through the background at a cut. */
export const SCENE_FADE_FRAMES = 9;

/** Calibrated on 9:16 videos in scripts/spike-mixed.ts; other ratios are not calibrated yet. */
export const STILL_STEP_SECONDS = 0.5;
export const STILL_THRESHOLD = 6;
export const LONGEST_STILL_SECONDS = 4;
/** The band between the headline and the captions, since text changes constantly. */
export const STILL_BAND = { top: 520 / 1920, height: 720 / 1920 };
export const STILL_SAMPLE_SIZE = { width: 120, height: 80 };

export interface StillStretch {
  from: number;
  to: number;
  seconds: number;
}

/**
 * Finds stretches where sampled frames barely change. `changes` holds the difference between each
 * pair of neighboring samples. This measures monotony only, and it cannot tell if a viewer understood.
 */
export function stillStretches(changes: number[], stepSeconds: number, threshold: number, minSeconds: number): StillStretch[] {
  const found: StillStretch[] = [];
  let start = -1;
  changes.concat(Number.POSITIVE_INFINITY).forEach((change, index) => {
    if (change < threshold) {
      if (start < 0) start = index;
      return;
    }
    if (start >= 0) {
      const seconds = (index - start) * stepSeconds;
      if (seconds >= minSeconds) found.push({ from: start * stepSeconds, to: index * stepSeconds, seconds });
      start = -1;
    }
  });
  return found;
}

/** Mean absolute difference between each pair of neighboring greyscale samples. */
export function frameChanges(samples: Uint8Array[]): number[] {
  return samples.slice(1).map((sample, index) => {
    const previous = samples[index];
    return sample.reduce((sum, value, position) => sum + Math.abs(value - previous[position]), 0) / sample.length;
  });
}

/** Indonesian note for the editor. Empty when nothing stayed still for too long. */
export function describeStillStretches(stretches: StillStretch[]): string {
  if (!stretches.length) return '';
  const seconds = (value: number) => value.toFixed(1).replace('.', ',');
  const ranges = stretches.map((item) => `${seconds(item.from)}–${seconds(item.to)}`).join(', ');
  return `Ada ${stretches.length} bagian yang hampir diam lebih dari ${LONGEST_STILL_SECONDS} detik, yaitu detik ${ranges}. Cek bagian ini saat menonton.`;
}
