import { redirect } from 'next/navigation';
import { BillingClient } from '@/components/billing/BillingClient';
import { getCurrentUser } from '@/lib/auth/session';
import { CREDIT_PACKAGES } from '@/lib/billing/packages';
import { isXenditTestMode } from '@/lib/billing/xendit';

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/billing');

  return <BillingClient email={user.email} initialCredits={user.credits} packages={CREDIT_PACKAGES} testMode={isXenditTestMode()} />;
}
