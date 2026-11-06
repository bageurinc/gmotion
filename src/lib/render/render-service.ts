import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { StudioProject, AspectRatioDimensions } from '@/types/studio';

export interface RenderProgressCallback {
  (progress: number): void;
}

export interface VideoRenderProvider {
  renderProject(
    project: StudioProject,
    onProgress?: RenderProgressCallback
  ): Promise<{ outputPath: string; outputUrl: string }>;
}

export class LocalRemotionRenderProvider implements VideoRenderProvider {
  async renderProject(
    project: StudioProject,
    onProgress?: RenderProgressCallback
  ): Promise<{ outputPath: string; outputUrl: string }> {
    const projectId = project.id;
    const projectDir = path.join(process.cwd(), 'storage', 'projects', projectId);
    const buildSrcDir = path.join(projectDir, 'build-src');
    const exportsDir = path.join(projectDir, 'exports');

    if (!fs.existsSync(buildSrcDir)) fs.mkdirSync(buildSrcDir, { recursive: true });
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

    // 1. Materialize virtual TSX files to disk
    for (const [filename, code] of Object.entries(project.files)) {
      const filePath = path.join(buildSrcDir, filename);
      fs.writeFileSync(filePath, code, 'utf-8');
    }

    const { width, height } = AspectRatioDimensions[project.storyboard.aspectRatio] || {
      width: 1080,
      height: 1920,
    };

    const totalDurationInFrames = project.storyboard.scenes.reduce(
      (acc, s) => acc + (s.durationInFrames || 120),
      0
    );

    // 2. Write Root entry point for Remotion
    const rootEntryCode = `import React from 'react';
import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={${totalDurationInFrames}}
        fps={${project.storyboard.fps || 30}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};

export default RemotionRoot;
`;
    const rootPath = path.join(buildSrcDir, 'Root.tsx');
    fs.writeFileSync(rootPath, rootEntryCode, 'utf-8');

    // 3. Bundle with Remotion Bundler
    const motionKitDir = path.join(process.cwd(), 'src', 'motion-kit');
    const typesDir = path.join(process.cwd(), 'src', 'types');

    console.log(`[RenderService] Bundling project ${projectId}...`);
    const bundleLocation = await bundle({
      entryPoint: rootPath,
      webpackOverride: (config) => {
        return {
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...(config.resolve?.alias || {}),
              '@/motion-kit': motionKitDir,
              '@/types': typesDir,
            },
          },
        };
      },
    });

    // 4. Select Composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'MainVideo',
    });

    const outputFileName = 'video.mp4';
    const outputPath = path.join(exportsDir, outputFileName);

    console.log(`[RenderService] Rendering MP4 to ${outputPath}...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        const percent = Math.min(100, Math.round(progress * 100));
        if (onProgress) {
          onProgress(percent);
        }
      },
    });

    const outputUrl = `/api/projects/${projectId}/assets/exports/${outputFileName}`;
    return {
      outputPath,
      outputUrl,
    };
  }
}

// Singleton provider instance
export const renderProvider: VideoRenderProvider = new LocalRemotionRenderProvider();
