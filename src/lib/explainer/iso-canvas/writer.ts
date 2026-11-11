/**
 * Asks a model for code until it passes the checks, sending each rejection back with the
 * previous answer. Returns the passing result, or the last attempt with its problems so the
 * caller can report it honestly instead of saving broken code.
 */
export interface WriteAttempt<T> {
  value: T | null;
  problems: string[];
  attempts: number;
  /** One line per rejected attempt, for logs and the editor chat. */
  notes: string[];
}

export async function writeUntilValid<T>(options: {
  /** Sends the request with the feedback for this attempt (empty on the first). */
  ask: (feedback: string) => Promise<string>;
  /** Pulls the value out of the model's answer, or null when the format is wrong. */
  parse: (text: string) => T | null;
  check: (value: T) => string[];
  /** Renders a value back into the prompt so the model edits it rather than starting over. */
  show: (value: T) => string;
  attempts?: number;
}): Promise<WriteAttempt<T>> {
  const maxAttempts = options.attempts ?? 3;
  const notes: string[] = [];
  let feedback = '';
  let last: { value: T | null; problems: string[] } = { value: null, problems: ['The model returned nothing.'] };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const text = await options.ask(feedback);
    const value = options.parse(text);
    if (value === null) {
      last = { value: last.value, problems: ['The answer did not follow the required format.'] };
      notes.push(`Percobaan ${attempt}: format jawaban salah.`);
      feedback = '\n\nYour previous answer did not follow the required format. Answer again in exactly the required format.';
      continue;
    }
    const problems = options.check(value);
    if (!problems.length) return { value, problems: [], attempts: attempt, notes };
    last = { value, problems };
    notes.push(`Percobaan ${attempt} ditolak: ${problems.join(' | ').slice(0, 500)}`);
    feedback = `\n\nYour previous answer failed these checks. Fix every one and return the complete answer again:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n\nPrevious answer:\n${options.show(value).slice(0, 40_000)}`;
  }
  return { value: last.value, problems: last.problems, attempts: maxAttempts, notes };
}

/** Pulls fenced blocks by file name: a block whose first line is `// IsoObjects.ts` and so on. */
export function parseNamedBlocks(text: string, names: readonly string[]): Record<string, string> | null {
  const found: Record<string, string> = {};
  for (const match of text.matchAll(/```(?:ts|typescript|js|javascript|tsx)?\s*\n([\s\S]*?)```/g)) {
    const body = match[1];
    const header = /^\s*\/\/\s*([\w.]+)\s*\n/.exec(body);
    if (header && names.includes(header[1])) found[header[1]] = body.slice(header[0].length).trim() + '\n';
  }
  return names.every((name) => name in found) ? found : null;
}
