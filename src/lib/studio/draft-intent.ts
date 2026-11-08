import { z } from 'zod';
import { CreateProjectSchema } from '@/lib/security/project-input';

const DraftIntentSchema = CreateProjectSchema.extend({
  requestId: z.string().uuid(),
  startedAt: z.number().finite().nonnegative(),
  projectId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,80}$/)
    .optional(),
});

export type DraftIntent = z.infer<typeof DraftIntentSchema>;

const intentKey = (id: string) => `gmotion:draft:${id}`;

export function saveDraftIntent(intent: DraftIntent): void {
  sessionStorage.setItem(
    intentKey(intent.requestId),
    JSON.stringify(DraftIntentSchema.parse(intent)),
  );
}

export function readDraftIntent(id: string): DraftIntent | null {
  if (!z.string().uuid().safeParse(id).success) return null;
  try {
    const raw = sessionStorage.getItem(intentKey(id));
    const result = DraftIntentSchema.safeParse(raw ? JSON.parse(raw) : null);
    return result.success && result.data.requestId === id ? result.data : null;
  } catch {
    return null;
  }
}
