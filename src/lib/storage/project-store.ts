import fs from 'fs';
import path from 'path';
import { StudioProject } from '@/types/studio';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'projects');

export function ensureStorageDir(projectId?: string): string {
  const targetDir = projectId ? path.join(STORAGE_ROOT, projectId) : STORAGE_ROOT;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

export function saveProject(project: StudioProject): void {
  const dir = ensureStorageDir(project.id);
  const projectFile = path.join(dir, 'project.json');
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2), 'utf-8');
}

export function getProject(projectId: string): StudioProject | null {
  try {
    const projectFile = path.join(STORAGE_ROOT, projectId, 'project.json');
    if (!fs.existsSync(projectFile)) {
      return null;
    }
    const data = fs.readFileSync(projectFile, 'utf-8');
    return JSON.parse(data) as StudioProject;
  } catch (err) {
    console.error(`[ProjectStore] Error reading project ${projectId}:`, err);
    return null;
  }
}

export function listProjects(): StudioProject[] {
  try {
    if (!fs.existsSync(STORAGE_ROOT)) return [];
    const entries = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true });
    const projects: StudioProject[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const p = getProject(entry.name);
        if (p) projects.push(p);
      }
    }

    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('[ProjectStore] Error listing projects:', err);
    return [];
  }
}
