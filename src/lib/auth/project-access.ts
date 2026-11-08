import { NextResponse } from 'next/server';
import { getProject } from '@/lib/storage/project-store';
import { StudioProject } from '@/types/studio';
import { getCurrentUser, User } from './session';

/**
 * Projects created before accounts existed have no owner. They stay hidden unless
 * LEGACY_PROJECT_OWNER_EMAIL names the account that may keep using them.
 */
export function canAccessProject(user: User, project: StudioProject): boolean {
  if (project.ownerId) return project.ownerId === user.id;
  const legacyOwner = process.env.LEGACY_PROJECT_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(legacyOwner) && user.email.toLowerCase() === legacyOwner;
}

export async function requireUser(): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: 'Silakan masuk dulu.' }, { status: 401 }) };
  return { user };
}

/** Someone else's project answers 404, so ids cannot be probed for existence. */
export async function requireProject(
  projectId: string
): Promise<{ user: User; project: StudioProject } | { response: NextResponse }> {
  const auth = await requireUser();
  if ('response' in auth) return auth;
  const project = getProject(projectId);
  if (!project || !canAccessProject(auth.user, project)) {
    return { response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }
  return { user: auth.user, project };
}
