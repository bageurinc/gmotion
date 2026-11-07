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
