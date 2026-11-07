import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isValidProjectId } from '@/lib/security/project-input';

const MEDIA_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetPath: string[] }> }
) {
  const { projectId, assetPath } = await params;
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Only generated media is public. project.json and build sources stay private.
  const projectDir = path.join(process.cwd(), 'storage', 'projects', projectId);
  const [root, relativePath] =
    assetPath[0] === 'exports'
      ? [path.join(projectDir, 'exports'), assetPath.slice(1).join('/')]
      : [path.join(projectDir, 'assets'), assetPath.join('/')];
  const filePath = path.resolve(root, relativePath);
  const isInsideRoot = filePath.startsWith(`${root}${path.sep}`);
  const isMedia = MEDIA_TYPES[path.extname(filePath).toLowerCase()] !== undefined;

  if (!isInsideRoot || !isMedia || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const contentType = MEDIA_TYPES[path.extname(filePath).toLowerCase()];

  const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': stat.size.toString(),
      'Accept-Ranges': 'bytes',
      // Scene audio and video filenames can be replaced after a revision.
      'Cache-Control': 'private, no-cache, must-revalidate',
  };
  const range = req.method === 'HEAD' ? null : req.headers.get('range');
  let start = 0;
  let end = stat.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const invalid = () => new NextResponse(null, { status: 416, headers: {
      ...headers, 'Content-Length': '0', 'Content-Range': `bytes */${stat.size}`,
    } });
    if (!match || (!match[1] && !match[2]) || stat.size === 0) return invalid();
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    } else {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
      start = Math.max(0, stat.size - suffix);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= stat.size || start > end) return invalid();
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    headers['Content-Length'] = String(end - start + 1);
  }
  if (req.method === 'HEAD') return new NextResponse(null, { headers });
  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(range ? fileBuffer.subarray(start, end + 1) : fileBuffer, {
    status: range ? 206 : 200, headers,
  });
}

export const HEAD = GET;
