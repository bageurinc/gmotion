import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GET, HEAD } from '../src/app/api/projects/[projectId]/assets/[...assetPath]/route';

const projectId = `test-range-${randomUUID()}`;
const dir = path.join(process.cwd(), 'storage', 'projects', projectId);
const params = { params: Promise.resolve({ projectId, assetPath: ['voice.mp3'] }) };
beforeAll(() => {
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'voice.mp3'), Buffer.from('0123456789'));
  // Assets now require project access, so the fixture needs a project record.
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ id: projectId }));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

it.each([
  ['bytes=0-2', '012', 'bytes 0-2/10'],
  ['bytes=4-', '456789', 'bytes 4-9/10'],
  ['bytes=-3', '789', 'bytes 7-9/10'],
  ['bytes=8-99', '89', 'bytes 8-9/10'],
])('serves seek request %s with exact bytes', async (range, expected, contentRange) => {
  const response = await GET(new NextRequest('http://localhost/audio', { headers: { Range: range } }), params);
  expect(response.status).toBe(206);
  expect(response.headers.get('content-range')).toBe(contentRange);
  expect(response.headers.get('content-length')).toBe(String(expected.length));
  expect(response.headers.get('accept-ranges')).toBe('bytes');
  expect(await response.text()).toBe(expected);
});

it.each(['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=abc-def'])('rejects unsatisfiable range %s', async (range) => {
  const response = await GET(new NextRequest('http://localhost/audio', { headers: { Range: range } }), params);
  expect(response.status).toBe(416);
  expect(response.headers.get('content-range')).toBe('bytes */10');
  expect(await response.text()).toBe('');
});

it('serves full audio and HEAD metadata without caching mutable files forever', async () => {
  const response = await GET(new NextRequest('http://localhost/audio'), params);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-cache');
  expect(await response.text()).toBe('0123456789');
  const head = await HEAD(new NextRequest('http://localhost/audio', { method: 'HEAD' }), params);
  expect(head.headers.get('content-length')).toBe('10');
  expect(head.headers.get('accept-ranges')).toBe('bytes');
  expect(await head.text()).toBe('');
});
