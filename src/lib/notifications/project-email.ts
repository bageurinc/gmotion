import { after } from 'next/server';
import nodemailer from 'nodemailer';
import { hasVerifiedEmail, type User } from '@/lib/auth/session';
import type { StudioProject } from '@/types/studio';

const messages = {
  storyboard: {
    subject: 'Draf video siap ditinjau',
    instruction: 'Tinjau naskah dan adegan di Studio, lalu lanjutkan jika draf sudah sesuai.',
  },
  'story-svg': {
    subject: 'Draf objek SVG menunggu persetujuan',
    instruction: 'Buka Studio untuk menyetujui atau mengoreksi draf objek sebelum animasi dibuat.',
  },
  export: {
    subject: 'Video MP4 siap diunduh',
    instruction: 'Buka proyek di Studio, pilih Bagikan, lalu pilih Download .mp4.',
  },
} as const;

type ProjectEmail = keyof typeof messages;
type Recipient = Pick<User, 'email' | 'google_sub'>;
type EmailProject = Pick<StudioProject, 'id' | 'storyboard'>;

function canNotify(user: Recipient): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim() && process.env.APP_URL?.trim())
    && hasVerifiedEmail(user);
}

export async function sendProjectEmail(user: Recipient, project: EmailProject, event: ProjectEmail): Promise<void> {
  if (!canNotify(user)) return;

  try {
    const appUrl = new URL(process.env.APP_URL!);
    if (appUrl.protocol !== 'https:' && appUrl.protocol !== 'http:') {
      throw new Error('APP_URL must use HTTP or HTTPS');
    }
    const projectUrl = new URL(`/studio/${encodeURIComponent(project.id)}`, appUrl);
    const port = Number(process.env.SMTP_PORT?.trim() || 587);
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPassword = process.env.SMTP_PASSWORD;
    if (!Number.isInteger(port) || port < 1 || port > 65535 || Boolean(smtpUser) !== Boolean(smtpPassword)) {
      throw new Error('Invalid SMTP port or credentials');
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPassword! } : undefined,
      dnsTimeout: 5000,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
    const { subject, instruction } = messages[event];
    await transport.sendMail({
      from: process.env.SMTP_FROM!.trim(),
      to: { name: '', address: user.email },
      subject: `Gmotion · ${subject}`,
      text: `${subject}\n\nProyek: ${project.storyboard.title}\n\n${instruction}\n${projectUrl.href}`,
    });
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    console.error('[ProjectEmail] Delivery failed', { event, projectId: project.id, code });
  }
}

export function notifyProjectAfterResponse(user: Recipient, project: EmailProject, event: ProjectEmail): void {
  if (canNotify(user)) after(() => sendProjectEmail(user, project, event));
}
