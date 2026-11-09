import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BillingClient } from '@/components/billing/BillingClient';
import { getCurrentUser, hasVerifiedEmail } from '@/lib/auth/session';
import { CREDIT_PACKAGES } from '@/lib/billing/packages';
import { isXenditTestMode } from '@/lib/billing/xendit';

export const metadata: Metadata = { title: 'Kredit video' };

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/billing');

  return (
    <BillingClient
      email={user.email}
      initialCredits={user.credits}
      packages={CREDIT_PACKAGES}
      testMode={isXenditTestMode()}
      showGooglePasswordSettings={hasVerifiedEmail(user)}
    />
  );
}
