import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { sendProjectEmail } from '@/lib/notifications/project-email';
import type { StudioProject } from '@/types/studio';
import { TEST_USER } from './setup-auth';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));

const project = {
  id: 'proj_email',
  storyboard: { title: 'Kopi V60' } as StudioProject['storyboard'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_URL', 'https://studio.example.com');
  vi.stubEnv('SMTP_HOST', 'smtp.example.com');
  vi.stubEnv('SMTP_PORT', '587');
  vi.stubEnv('SMTP_FROM', 'studio@example.com');
  vi.stubEnv('SMTP_USER', '');
  vi.stubEnv('SMTP_PASSWORD', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([
  ['storyboard', 'Draf video siap ditinjau'],
  ['story-svg', 'Draf objek SVG menunggu persetujuan'],
  ['export', 'Video MP4 siap diunduh'],
] as const)('sends %s to the verified project user with the Studio link', async (event, subject) => {
  await sendProjectEmail(TEST_USER, project, event);
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: 'smtp.example.com', port: 587, secure: false, requireTLS: true,
  }));
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    to: { name: '', address: TEST_USER.email },
    subject: `Gmotion · ${subject}`,
    text: expect.stringContaining('https://studio.example.com/studio/proj_email'),
  }));
});

it('skips unverified addresses and works with SMTP disabled', async () => {
  await sendProjectEmail({ ...TEST_USER, google_sub: 'password:test' }, project, 'story-svg');
  vi.stubEnv('SMTP_HOST', '');
  await sendProjectEmail(TEST_USER, project, 'export');
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
});

it('handles an SMTP error without failing the workflow', async () => {
  sendMail.mockRejectedValueOnce(Object.assign(new Error('Connection refused'), { code: 'ECONNECTION' }));
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(sendProjectEmail(TEST_USER, project, 'export')).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith('[ProjectEmail] Delivery failed', {
    event: 'export', projectId: project.id, code: 'ECONNECTION',
  });
});
