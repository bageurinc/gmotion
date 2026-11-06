import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetPath: string[] }> }
) {
  const { projectId, assetPath } = await params;
  const projectDir = path.join(process.cwd(), 'storage', 'projects', projectId);

  // Security check to avoid directory traversal
  const relativeJoined = assetPath.join('/');
  if (relativeJoined.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Check in assets/ or exports/
  let filePath = path.join(projectDir, 'assets', relativeJoined);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(projectDir, relativeJoined);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(projectDir, 'exports', relativeJoined);
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = 'application/octet-stream';
  if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.json') contentType = 'application/json';

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
