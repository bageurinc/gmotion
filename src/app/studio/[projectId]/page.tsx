import React from 'react';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/storage/project-store';
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

  return <StudioWorkspaceClient initialProject={project} />;
}
