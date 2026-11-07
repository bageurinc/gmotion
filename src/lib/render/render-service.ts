import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { StudioProject, AspectRatioDimensions, SocialPlatformSchema } from '@/types/studio';

export interface RenderProgressCallback {
  (progress: number): void;
}

export interface VideoRenderProvider {
  renderProject(
    project: StudioProject,
    onProgress?: RenderProgressCallback
  ): Promise<{ outputPath: string; outputUrl: string }>;
}

export const COMPOSITION_ID = 'MainVideo';

/** Materializes a project and bundles it. Exports and scene checks share this code path. */
export async function bundleProject(project: StudioProject): Promise<string> {
    const projectId = project.id;
    const projectDir = path.join(process.cwd(), 'storage', 'projects', projectId);
    const buildSrcDir = path.join(projectDir, 'build-src');

    if (!fs.existsSync(buildSrcDir)) fs.mkdirSync(buildSrcDir, { recursive: true });

    // Copy any assets (like audio) into publicDir for Remotion bundler
    const publicDir = path.join(buildSrcDir, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const assetsDir = path.join(projectDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      for (const assetFile of assetFiles) {
        fs.copyFileSync(path.join(assetsDir, assetFile), path.join(publicDir, assetFile));
      }
    }

    // 1. Materialize virtual TSX files to disk
    for (const [filename, code] of Object.entries(project.files)) {
      // Bundled public assets are served under /public/, not the bundle root.
      // Rewrite every virtual file and preserve audio revision query strings.
      let finalCode = code.split(`/api/projects/${projectId}/assets/`).join('/public/');

      if (filename === 'MainVideo.tsx') {
        if (!finalCode.includes('export default') && finalCode.includes('MainVideo')) {
          finalCode += '\nexport default MainVideo;\n';
        }
      }

      // Ensure Scene files have export default
      const sceneMatch = filename.match(/^Scene(\d+)\.tsx$/);
      if (sceneMatch) {
        const sceneNum = sceneMatch[1];
        const compName = `Scene${sceneNum}`;
        if (!finalCode.includes('export default') && finalCode.includes(compName)) {
          finalCode += `\nexport default ${compName};\n`;
        }
      }

      const filePath = path.join(buildSrcDir, filename);
      fs.writeFileSync(filePath, finalCode, 'utf-8');
    }

    const { width, height } = AspectRatioDimensions[project.storyboard.aspectRatio] || {
      width: 1080,
      height: 1920,
    };

    const totalDurationInFrames = project.storyboard.scenes.reduce(
      (acc, s) => acc + (s.durationInFrames || 120),
      0
    );
    const platform = SocialPlatformSchema.catch('tiktok').parse(project.safeAreaPlatform);

    // 2. Write Root entry point for Remotion with registerRoot
    const rootEntryCode = `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { MainVideo } from './MainVideo';
import { SocialSafeFrame } from '@/components/video/SocialSafeFrame';

const SafeMainVideo: React.FC = () => (
  <SocialSafeFrame platform=${JSON.stringify(platform)}><MainVideo /></SocialSafeFrame>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${COMPOSITION_ID}"
        component={SafeMainVideo}
        durationInFrames={${totalDurationInFrames}}
        fps={${project.storyboard.fps || 30}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};

registerRoot(RemotionRoot);

export default RemotionRoot;
`;
    const rootPath = path.join(buildSrcDir, 'Root.tsx');
    fs.writeFileSync(rootPath, rootEntryCode, 'utf-8');

    // 3. Bundle with Remotion Bundler
    const motionKitDir = path.join(process.cwd(), 'src', 'motion-kit');
    const typesDir = path.join(process.cwd(), 'src', 'types');
    const srcDir = path.join(process.cwd(), 'src');

    console.log(`[RenderService] Bundling project ${projectId}...`);
    return bundle({
      entryPoint: rootPath,
      publicDir: publicDir,
      ignoreRegisterRootWarning: true,
      webpackOverride: (config) => {
        return {
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...(config.resolve?.alias || {}),
              '@/motion-kit': motionKitDir,
              '@/types': typesDir,
              '@': srcDir,
            },
          },
        };
      },
    });
}

export class LocalRemotionRenderProvider implements VideoRenderProvider {
  async renderProject(
    project: StudioProject,
    onProgress?: RenderProgressCallback
  ): Promise<{ outputPath: string; outputUrl: string }> {
    const projectId = project.id;
    const exportsDir = path.join(process.cwd(), 'storage', 'projects', projectId, 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

    const bundleLocation = await bundleProject(project);

    // 4. Select Composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: COMPOSITION_ID,
    });

    const outputFileName = 'video.mp4';
    const outputPath = path.join(exportsDir, outputFileName);

    console.log(`[RenderService] Rendering MP4 to ${outputPath}...`);
    let lastPercent = -1;
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        const percent = Math.min(100, Math.round(progress * 100));
        if (onProgress && percent !== lastPercent) {
          lastPercent = percent;
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
