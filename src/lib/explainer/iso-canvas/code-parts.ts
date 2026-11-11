/**
 * Reads and replaces the parts of the assembled isometric canvas files: one exported function
 * per object in IsoObjects.ts, and the body of each close-up `draw` in IsoScenes.ts. The files
 * are written by assemble.ts, but object and close-up code comes from the model, so braces are
 * matched with a small scanner that skips strings, template literals, and comments.
 */

/** Index just past the bracket that closes the one at `open` (`{` or `(`), or -1. */
export function matchClose(source: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '(': ')' };
  const closer = pairs[source[open]];
  if (!closer) return -1;
  const stack: string[] = [closer];
  // Template literals nest: `${` opens code inside a string, `}` returns to the string.
  const templates: number[] = [];
  let i = open + 1;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (templates.length && templates[templates.length - 1] === stack.length) {
      // Inside template text.
      if (char === '\\') { i += 2; continue; }
      if (char === '`') { templates.pop(); i += 1; continue; }
      if (char === '$' && next === '{') { stack.push('}'); i += 2; continue; }
      i += 1;
      continue;
    }
    if (char === '/' && next === '/') { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (char === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue; }
    if (char === '"' || char === "'") {
      i += 1;
      while (i < source.length && source[i] !== char && source[i] !== '\n') i += source[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (char === '`') { templates.push(stack.length); i += 1; continue; }
    if (char === '{' || char === '(') { stack.push(pairs[char]); i += 1; continue; }
    if (char === '}' || char === ')') {
      if (stack[stack.length - 1] !== char) return -1;
      stack.pop();
      i += 1;
      if (!stack.length) return i;
      continue;
    }
    i += 1;
  }
  return -1;
}

/** Start and end (exclusive) of `[export] function name(...) { ... }` in a file, or null. */
export function functionSpan(file: string, name: string): { start: number; end: number } | null {
  const match = new RegExp(`(?:\\bexport\\s+)?\\bfunction\\s+${name}\\s*\\(`).exec(file);
  if (!match) return null;
  const paramsOpen = match.index + match[0].length - 1;
  const paramsEnd = matchClose(file, paramsOpen);
  if (paramsEnd < 0) return null;
  const bodyOpen = file.indexOf('{', paramsEnd);
  if (bodyOpen < 0) return null;
  const end = matchClose(file, bodyOpen);
  return end < 0 ? null : { start: match.index, end };
}

export function readFunction(file: string, name: string): string | null {
  const span = functionSpan(file, name);
  return span ? file.slice(span.start, span.end) : null;
}

export function replaceFunction(file: string, name: string, code: string): string | null {
  const span = functionSpan(file, name);
  return span ? file.slice(0, span.start) + code.trim() + file.slice(span.end) : null;
}

export const MOTION_MARKER = '// Motion added by revisions: the engine moves these objects and draws every object in depth order.';

export interface MotionObject {
  /** Exported function name, e.g. drawOrangKunci. */
  name: string;
  at: [number, number, number];
  path?: { key: string; to: [number, number, number] };
}

/** The model-written drawing of an object once motion wraps it. */
export const shapeName = (name: string) => `${name}Shape`;

/**
 * Wraps object functions so the engine can move them along their path and draw them in depth
 * order (a person walking through a gate passes in front of it, then behind it, correctly).
 * The model's function is renamed to `<name>Shape`; `<name>` keeps its signature, so the world
 * and close-ups call it unchanged. Idempotent: the block is rebuilt from the plan every time.
 */
export function applyMotion(objectsFile: string, objects: MotionObject[]): string {
  const marker = objectsFile.indexOf(MOTION_MARKER);
  let file = marker < 0 ? objectsFile : objectsFile.slice(0, marker).trimEnd() + '\n';
  if (!objects.some((object) => object.path)) {
    // No motion left: give the model's functions their exported names back.
    for (const object of objects) file = file.replace(new RegExp(`(^|\\n)function\\s+${shapeName(object.name)}\\s*\\(`), `$1export function ${object.name}(`);
    return file;
  }
  const wrappers = objects.map((object) => {
    file = file.replace(new RegExp(`\\bexport\\s+function\\s+${object.name}\\s*\\(`), `function ${shapeName(object.name)}(`);
    const shape = `${shapeName(object.name)}(iso, state, t)`;
    if (!object.path) {
      return `export function ${object.name}(iso: Iso, state: Record<string, number>, t: number) {\n  iso.defer(() => ${shape});\n}`;
    }
    const [dx, dy, dz] = object.path.to.map((value, axis) => Math.round((value - object.at[axis]) * 1000) / 1000);
    return `export function ${object.name}(iso: Iso, state: Record<string, number>, t: number) {
  const k = state['${object.path.key}'] ?? 0;
  iso.defer(() => iso.at(${dx} * k, ${dy} * k, ${dz} * k, () => ${shape}), ${dx + dy} * k);
}`;
  });
  return `${file.trimEnd()}\n\n${MOTION_MARKER}\n${wrappers.join('\n\n')}\n`;
}

const DETAIL_DRAW = 'draw: (iso: Iso, t: number) => {';

const dedent = (code: string) => {
  const lines = code.split('\n');
  const indents = lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(Math.min(cut, /^ */.exec(line)![0].length))).join('\n').trim();
};

/** The close-up bodies of IsoScenes.ts in scene order, as written by assembleScenes. */
export function detailBodies(scenesFile: string): string[] | null {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const at = scenesFile.indexOf(DETAIL_DRAW, from);
    if (at < 0) return bodies;
    const open = at + DETAIL_DRAW.length - 1;
    const end = matchClose(scenesFile, open);
    if (end < 0) return null;
    bodies.push(dedent(scenesFile.slice(open + 1, end - 1)));
    from = end;
  }
}

/** drawWorld as the model wrote it: IsoWorld.ts without the import lines worldFile adds. */
export function worldBody(worldFile: string): string {
  return worldFile.split('\n').filter((line) => !/^\s*import\s/.test(line)).join('\n').trim();
}
