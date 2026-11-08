import { redirect } from 'next/navigation';

// Google sign-in creates the account on first use, so both paths share one page.
export default function RegisterPage() {
  redirect('/login');
}
