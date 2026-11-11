import React, { useMemo } from 'react';
import { Composition, registerRoot } from 'remotion';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';

/**
 * One bundle for every server-side render of isometric canvas code: the files arrive as input
 * props and are compiled in the page the same way the studio preview compiles them, so the
 * job never rebundles between attempts.
 */
export interface IsoPreviewProps extends Record<string, unknown> {
  files: Record<string, string>;
  width: number;
  height: number;
  durationInFrames: number;
}

const Preview: React.FC<IsoPreviewProps> = ({ files }) => {
  const Component = useMemo(() => compileVirtualProject(files, 'Preview.tsx'), [files]);
  return <Component />;
};

const Root: React.FC = () => (
  <Composition
    id="IsoPreview"
    component={Preview}
    durationInFrames={1}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ files: {}, width: 1080, height: 1920, durationInFrames: 1 }}
    calculateMetadata={({ props }) => ({ width: props.width, height: props.height, durationInFrames: Math.max(1, props.durationInFrames) })}
  />
);

registerRoot(Root);
