import { describe, it, expect } from 'vitest';
import { validateSceneCode } from '../src/lib/pipeline/code-validator';

describe('Stage 4: AST & Remotion Safety Code Validator', () => {
  it('passes valid Remotion TSX code using @/motion-kit', () => {
    const validCode = `
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { CameraRig, KineticHeadline } from '@/motion-kit';

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  return (
    <CameraRig mode="macro-zoom-in">
      <KineticHeadline text="Halo Dunia" />
    </CameraRig>
  );
};
export default Scene1;
`;
    const result = validateSceneCode(validCode, 'Scene1.tsx');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects forbidden imports such as fs and axios', () => {
    const invalidCode = `
import React from 'react';
import fs from 'fs';
import axios from 'axios';

export const Scene1 = () => <div>Hack</div>;
`;
    const result = validateSceneCode(invalidCode, 'Scene1.tsx');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Forbidden import 'fs'"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Forbidden import 'axios'"))).toBe(true);
  });

  it('rejects non-deterministic Math.random() in scene code', () => {
    const nonDeterministicCode = `
import React from 'react';
export const Scene1 = () => {
  const x = Math.random() * 100;
  return <div>{x}</div>;
};
`;
    const result = validateSceneCode(nonDeterministicCode, 'Scene1.tsx');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Math.random()'))).toBe(true);
  });

  it('rejects timer functions setTimeout and setInterval', () => {
    const timerCode = `
import React from 'react';
export const Scene1 = () => {
  setTimeout(() => {}, 1000);
  return <div>Timer</div>;
};
`;
    const result = validateSceneCode(timerCode, 'Scene1.tsx');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('timer functions'))).toBe(true);
  });

  it('warns about CSS transition anti-patterns', () => {
    const cssTransitionCode = `
import React from 'react';
export const Scene1 = () => {
  return <div style={{ transition: 'all 0.3s ease' }}>Smooth</div>;
};
`;
    const result = validateSceneCode(cssTransitionCode, 'Scene1.tsx');
    expect(result.warnings.some((w) => w.includes('CSS transitions'))).toBe(true);
  });

  it('rejects JSX that only the export compiler refuses', () => {
    const code = `import React from 'react';
export const Scene1 = () => <text>PENETRASI > 5.0M</text>;
export default Scene1;`;
    const result = validateSceneCode(code, 'Scene1.tsx');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Export compilation error/);
  });
});
