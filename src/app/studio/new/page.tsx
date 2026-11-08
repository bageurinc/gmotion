import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { DraftPreparationClient } from '@/components/studio/DraftPreparationClient';

export const metadata: Metadata = { title: 'Menyusun draf' };

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request = '' } = await searchParams;
  if (!(await getCurrentUser()))
    redirect(
      `/login?next=${encodeURIComponent(`/studio/new?request=${request}`)}`,
    );
  return <DraftPreparationClient requestId={request} />;
}
