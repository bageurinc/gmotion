import type { StudioProject, TextStyleId } from '@/types/studio';
import { continuedScenes } from '@/lib/explainer/continuity';
import { generateMainVideoCode } from './coder-agent';

const STYLE_PROP = /\btextStyle=(?:"[a-z]+"|\{\s*["'][a-z]+["']\s*\})/g;

/**
 * Changes the font pair of a finished video without any model call. Scenes that name a style get
 * the new one, and MainVideo passes it to every scene that does not, such as simple and CTA scenes.
 */
export function applyTextStyle(project: StudioProject, textStyle: TextStyleId): StudioProject {
  // Older projects have no saved suggestion; the style before the first change was the director's.
  const storyboard = { ...project.storyboard, textStyle, textStyleSuggested: project.storyboard.textStyleSuggested ?? project.storyboard.textStyle };
  const files = Object.fromEntries(Object.entries(project.files).map(([name, code]) => [
    name,
    /^Scene\d+\.tsx$/.test(name) ? code.replace(STYLE_PROP, `textStyle="${textStyle}"`) : code,
  ]));
  const main = project.files['MainVideo.tsx'];
  if (main) {
    // Rebuilt from the scenes it already imports, so the order and the fade-free cuts stay the same.
    const indexes = [...main.matchAll(/import Scene(\d+) from/g)].map((match) => Number(match[1]) - 1);
    files['MainVideo.tsx'] = generateMainVideoCode(storyboard, indexes, continuedScenes(storyboard.scenes, project.sceneAssets));
  }
  return { ...project, storyboard, files };
}
