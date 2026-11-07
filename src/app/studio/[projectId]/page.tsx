import React from 'react';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/storage/project-store';
import { DraftReviewClient } from '@/components/studio/DraftReviewClient';
import { StudioWorkspaceClient } from '@/components/studio/StudioWorkspaceClient';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioPage({ params }: PageProps) {
  const { projectId } = await params;
  const project = getProject(projectId);

  if (!project) {
    notFound();
  }

  if (project.status === 'draft') {
    return <DraftReviewClient initialProject={project} />;
  }

  return <StudioWorkspaceClient initialProject={project} />;
}
