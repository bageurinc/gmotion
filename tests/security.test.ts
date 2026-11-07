import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getAsset } from '@/app/api/projects/[projectId]/assets/[...assetPath]/route';
import { PUT as updateProject } from '@/app/api/projects/[projectId]/route';
import { POST as createProject } from '@/app/api/projects/route';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';

const projectId = 'security-test';
const dir = path.join(process.cwd(), 'storage', 'projects', projectId);
const scene = (body: string) => `import React from 'react';\nexport const Scene1 = () => { ${body} return <div />; };\nexport default Scene1;`;
const put = (body: unknown) =>
  updateProject(new NextRequest('http://localhost/api', { method: 'PUT', body: JSON.stringify(body) }), {
    params: Promise.resolve({ projectId }),
  });
const asset = (id: string, assetPath: string[]) =>
  getAsset(new NextRequest('http://localhost/api'), { params: Promise.resolve({ projectId: id, assetPath }) });

beforeAll(() => {
  saveProject({
    id: projectId,
    createdAt: 1,
    updatedAt: 1,
    userPrompt: 'Topik',
    storyboard: generateProceduralStoryboard('Topik', 'story-2d', '9:16'),
    files: { 'Scene1.tsx': scene('') },
    chatHistory: [],
    status: 'ready',
  } as StudioProject);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'voice.mp3'), 'audio');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('scene code validator', () => {
  it.each([
    ['fetch', "fetch('/api/projects');"],
    ['eval', "eval('1');"],
    ['window', 'window.alert(1);'],
    ['document cookie', 'const c = document.cookie;'],
    ['dynamic import', "import('fs');"],
    ['constructor escape', "const f = [].map.constructor('return 1');"],
    ['computed constructor', "const f = [].map['constructor']('return 1');"],
    ['raw html', 'const p = { dangerouslySetInnerHTML: { __html: "x" } };'],
    ['timer', 'setTimeout(() => {}, 1);'],
  ])('rejects %s', (_, body) => {
    expect(validateSceneCode(scene(body)).valid).toBe(false);
  });

  it('rejects dangerous elements and external URLs', () => {
    expect(validateSceneCode(`import React from 'react';\nexport const S = () => <iframe src="/x" />;`).valid).toBe(false);
    expect(validateSceneCode(`import React from 'react';\nexport const S = () => <image href="https://evil.test/a.png" />;`).valid).toBe(false);
  });

  it('allows local variables that share a global name', () => {
    const code = scene('const top = 10; const location = { x: 1 }; const parent = top + location.x;');
    expect(validateSceneCode(code).errors).toEqual([]);
  });

  it('allows a relative SVG gradient reference', () => {
    const code = `import React from 'react';\nexport const S = () => <svg><rect fill="url(#asset-a)" /><use href="#asset-b" /></svg>;`;
    expect(validateSceneCode(code).errors).toEqual([]);
  });
});

describe('project update', () => {
  it('blocks path traversal in file names', async () => {
    const res = await put({ files: { '../../../evil.tsx': 'x' } });
    expect(res.status).toBe(400);
  });

  it('blocks fields users must not set', async () => {
    const res = await put({ status: 'ready', id: 'other', files: {} });
    expect(res.status).toBe(400);
  });

  it('blocks unsafe scene code', async () => {
    const res = await put({ files: { 'Scene1.tsx': scene("fetch('/secret');") } });
    expect(res.status).toBe(400);
    expect(getProject(projectId)?.files['Scene1.tsx']).not.toContain('fetch');
  });

  it('merges a valid scene edit', async () => {
    const code = scene('const edited = 1;');
    const res = await put({ files: { 'Scene1.tsx': code } });
    expect(res.status).toBe(200);
    expect(getProject(projectId)?.files['Scene1.tsx']).toBe(code);
  });
});

describe('project creation', () => {
  it('rejects an oversized prompt and unknown preset', async () => {
    const post = (body: unknown) => createProject(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }));
    expect((await post({ prompt: 'a'.repeat(8001) })).status).toBe(400);
    expect((await post({ prompt: 'Topik', preset: 'hacked' })).status).toBe(400);
  });
});

describe('asset access', () => {
  it('serves generated media', async () => {
    expect((await asset(projectId, ['voice.mp3'])).status).toBe(200);
  });

  it('never serves project data or build sources', async () => {
    expect((await asset(projectId, ['project.json'])).status).toBe(404);
    expect((await asset(projectId, ['..', 'project.json'])).status).toBe(404);
    expect((await asset(projectId, ['exports', '..', '..', 'project.json'])).status).toBe(404);
  });

  it('rejects an invalid project id', async () => {
    expect((await asset('..', ['voice.mp3'])).status).toBe(404);
    expect(getProject('../secret')).toBeNull();
  });
});
