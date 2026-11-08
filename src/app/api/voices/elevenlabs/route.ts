import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/project-access';
import { isElevenLabsConfigured, listElevenLabsVoices } from '@/lib/audio/elevenlabs';
import { CREDITS_PER_VIDEO, ELEVENLABS_EXTRA_CREDITS } from '@/lib/billing/credits';

/** Tells the draft screen whether the ElevenLabs voice can be offered, and at what price. */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  if (!isElevenLabsConfigured()) return NextResponse.json({ available: false, voices: [] });
  return NextResponse.json({
    available: true,
    voices: await listElevenLabsVoices(),
    credits: CREDITS_PER_VIDEO + ELEVENLABS_EXTRA_CREDITS,
    baseCredits: CREDITS_PER_VIDEO,
  });
}
