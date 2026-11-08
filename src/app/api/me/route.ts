import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Silakan masuk dulu.' }, { status: 401 });
  return NextResponse.json({
    user: { email: user.email, name: user.name, avatarUrl: user.avatar_url, credits: user.credits },
  });
}
