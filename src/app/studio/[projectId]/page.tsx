import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { canAccessProject } from '@/lib/auth/project-access';
import { getCurrentUser } from '@/lib/auth/session';
import { getProject } from '@/lib/storage/project-store';
import { DraftReviewClient } from '@/components/studio/DraftReviewClient';
import { StudioWorkspaceClient } from '@/components/studio/StudioWorkspaceClient';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioPage({ params }: PageProps) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/studio/${encodeURIComponent(projectId)}`);

  const project = getProject(projectId);

  if (!project || !canAccessProject(user, project)) {
    notFound();
  }

  if (project.status === 'draft') {
    return <DraftReviewClient initialProject={project} />;
  }

  return <StudioWorkspaceClient initialProject={project} />;
}
