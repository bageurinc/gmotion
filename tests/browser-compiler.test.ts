import { describe, it, expect } from 'vitest';
import { compileVirtualProject } from '../src/lib/runtime/browser-compiler';

describe('In-Browser Dynamic Sucrase Compiler', () => {
  it('compiles a standalone scene importing @/motion-kit in < 50ms', () => {
    const sceneCode = `
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { CameraRig, KineticHeadline } from '@/motion-kit';

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CameraRig mode="macro-zoom-in">
      <KineticHeadline text="Halo Studio" />
    </CameraRig>
  );
};
export default Scene1;
`;

    const start = performance.now();
    const Component = compileVirtualProject(
      { 'Scene1.tsx': sceneCode },
      'Scene1.tsx'
    );
    const elapsed = performance.now() - start;

    expect(typeof Component).toBe('function');
    expect(elapsed).toBeLessThan(50);
  });

  it('compiles MainVideo that links to Scene1 and Scene2 via virtual require', () => {
    const files = {
      'Scene1.tsx': `
import React from 'react';
export const Scene1 = () => <div>Scene 1 Content</div>;
export default Scene1;
`,
      'Scene2.tsx': `
import React from 'react';
export const Scene2 = () => <div>Scene 2 Content</div>;
export default Scene2;
`,
      'MainVideo.tsx': `
import React from 'react';
import Scene1 from './Scene1';
import Scene2 from './Scene2';

export const MainVideo: React.FC = () => {
  return (
    <div>
      <Scene1 />
      <Scene2 />
    </div>
  );
};
export default MainVideo;
`,
    };

    const start = performance.now();
    const MainComponent = compileVirtualProject(files, 'MainVideo.tsx');
    const elapsed = performance.now() - start;

    expect(typeof MainComponent).toBe('function');
    expect(elapsed).toBeLessThan(50);
  });

  it('automatically normalizes named exports when default export is missing', () => {
    const files = {
      'Scene1.tsx': `
import React from 'react';
// Intentionally no export default!
export const Scene1: React.FC = () => <div>Named Export Only</div>;
`,
      'MainVideo.tsx': `
import React from 'react';
import Scene1 from './Scene1';

export const MainVideo: React.FC = () => {
  return <Scene1 />;
};
export default MainVideo;
`,
    };

    const MainComponent = compileVirtualProject(files, 'MainVideo.tsx');
    expect(typeof MainComponent).toBe('function');
  });

  it('gracefully handles missing icons from lucide-react without crashing', () => {
    const files = {
      'Scene1.tsx': `
import React from 'react';
// Non-existent icon in lucide-react
import { NonExistentCustomIcon123 } from 'lucide-react';

export const Scene1: React.FC = () => {
  return (
    <div>
      <NonExistentCustomIcon123 size={24} />
      <span>Icon test</span>
    </div>
  );
};
export default Scene1;
`,
    };

    const Component = compileVirtualProject(files, 'Scene1.tsx');
    expect(typeof Component).toBe('function');
  });
});
