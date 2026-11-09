import vm from 'node:vm';
import React from 'react';
import { transform } from 'sucrase';
import * as draftKit from '@/motion-kit/isometric/draft-kit';
import { DraftMetaSchema, previewCases, projectAnchor, validateDraftCode, DRAFT_CANVAS, type DraftMeta } from './draft-contract';

const RENDER_TIMEOUT_MS = 1000;
const MARKUP_LIMIT = 250_000;

export interface PreviewResult {
  key: string;
  label: string;
  variant: string;
  svg: string | null;
  error: string | null;
}

export interface DraftCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface DraftReport {
  previews: PreviewResult[];
  checks: DraftCheck[];
  /** Every check passed, so the draft could be published once publishing exists. */
  ready: boolean;
}

const MODULES: Record<string, unknown> = { react: React, '@/motion-kit/isometric/draft-kit': draftKit };

// SVG attributes React keeps in camelCase; everything else is written kebab-case.
const CAMEL_ATTRIBUTES = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternContentUnits', 'patternTransform',
  'spreadMethod', 'stdDeviation', 'clipPathUnits', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'maskUnits',
  'maskContentUnits', 'textLength', 'lengthAdjust', 'pathLength', 'filterUnits', 'primitiveUnits', 'startOffset', 'baseFrequency', 'numOctaves',
]);
const FRAGMENT = Symbol.for('react.fragment');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, '&quot;');
const attributeName = (name: string) => name === 'className' ? 'class'
  : name === 'xlinkHref' ? 'xlink:href'
  : CAMEL_ATTRIBUTES.has(name) || name.startsWith('aria-') || name.startsWith('data-') ? name
  : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const styleText = (style: Record<string, unknown>) => Object.entries(style)
  .filter(([, value]) => value !== null && value !== undefined && value !== false)
  .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(value)}`).join(';');

/**
 * Serialises a tree of SVG elements and plain function components to markup. Next.js does
 * not allow react-dom/server in app code, and drafts need nothing more: hooks, context, and
 * class components are not part of the draft contract, so they fail here instead of rendering.
 */
export function renderSvgMarkup(node: unknown, depth = 0): string {
  if (depth > 200) throw new Error('Component tree is too deep');
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return escapeText(node);
  // Non-finite numbers are written out as is, so the NaN/Infinity check can report them.
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child) => renderSvgMarkup(child, depth + 1)).join('');
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element || typeof element !== 'object' || !('type' in element)) throw new Error('Unsupported child in draft output');
  const props = element.props ?? {};
  if (element.type === FRAGMENT) return renderSvgMarkup(props.children, depth + 1);
  if (typeof element.type === 'function') {
    if ((element.type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent) throw new Error('Class components are not allowed in drafts');
    return renderSvgMarkup((element.type as (input: Record<string, unknown>) => unknown)(props), depth + 1);
  }
  if (typeof element.type !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(element.type)) throw new Error('Unsupported element type in draft output');
  const attributes = Object.entries(props)
    .filter(([name, value]) => name !== 'children' && name !== 'key' && name !== 'ref' && typeof value !== 'function' && value !== null && value !== undefined && value !== false)
    .map(([name, value]) => {
      if (name === 'style' && typeof value === 'object') return `style="${escapeAttribute(styleText(value as Record<string, unknown>))}"`;
      return `${attributeName(name)}="${escapeAttribute(value === true ? '' : String(value))}"`;
    });
  return `<${element.type}${attributes.length ? ` ${attributes.join(' ')}` : ''}>${renderSvgMarkup(props.children, depth + 1)}</${element.type}>`;
}

/**
 * Runs validated draft code in a fresh VM context with a time limit. The context only
 * sees React, the draft kit, and the renderer; it has no require, process, or network.
 * The VM is not a security boundary on its own: code reaches it only after validateDraftCode.
 */
function renderInSandbox(code: string, cases: ReadonlyArray<{ props: Record<string, unknown> }>, repeat = 1): Array<{ svg: string | null; error: string | null }> {
  const compiled = transform(code, { transforms: ['jsx', 'typescript', 'imports'], jsxRuntime: 'classic', production: true }).code;
  const sandbox: Record<string, unknown> = {
    module: { exports: {} },
    require: (name: string) => {
      if (!(name in MODULES)) throw new Error(`Module ${name} is not available to drafts`);
      return MODULES[name];
    },
    __render: (component: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>) =>
      renderSvgMarkup(React.createElement(component, props)),
    __props: {},
  };
  sandbox.exports = (sandbox.module as { exports: object }).exports;
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(compiled, context, { timeout: RENDER_TIMEOUT_MS, filename: 'DraftAsset.js' });
  // One script per render, each with its own time limit. After a timeout the remaining
  // renders are skipped, so a runaway draft costs at most one limit, not one per state.
  const results: Array<{ svg: string | null; error: string | null }> = [];
  let timedOut = false;
  for (const item of cases) {
    for (let round = 0; round < repeat; round += 1) {
      if (timedOut) { results.push({ svg: null, error: 'Skipped after an earlier render timed out' }); continue; }
      sandbox.__props = item.props;
      try {
        // Wrapped in a function so its names cannot clash with the draft's top-level declarations.
        const svg = vm.runInContext(`(function () {
          var component = module.exports.default || exports.default;
          if (typeof component !== 'function') throw new Error('Default export is not a component');
          return __render(component, __props);
        })()`, context, { timeout: RENDER_TIMEOUT_MS, filename: 'DraftRender.js' });
        results.push({ svg: String(svg), error: null });
      } catch (error) {
        const text = String(error instanceof Error ? error.message : error);
        if (/timed out/i.test(text)) timedOut = true;
        results.push({ svg: null, error: text.slice(0, 300) });
      }
    }
  }
  return results;
}

/** Strips ids React generates, so two renders of the same state compare equal. */
const comparable = (svg: string) => svg.replace(/\b(id|aria-labelledby)="[^"]*"|url\(#[^)]*\)|href="#[^"]*"/g, '');

/** Validates, renders every preview state, and runs the checks shown on the draft page. */
export function checkDraft(code: string, metaInput: unknown): DraftReport {
  const checks: DraftCheck[] = [];
  const codeErrors = validateDraftCode(code);
  checks.push({ id: 'code', label: 'Kode lolos validator', ok: codeErrors.length === 0, detail: codeErrors.slice(0, 5).join(' · ') || undefined });
  const metaResult = DraftMetaSchema.safeParse(metaInput);
  checks.push({
    id: 'meta', label: 'Metadata lengkap dan valid', ok: metaResult.success,
    detail: metaResult.success ? undefined : metaResult.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · '),
  });
  if (codeErrors.length || !metaResult.success) return { previews: [], checks, ready: false };
  const meta: DraftMeta = metaResult.data;

  const cases = previewCases(meta);
  let rendered: Array<{ svg: string | null; error: string | null }>;
  try {
    rendered = renderInSandbox(code, cases, 2);
  } catch (error) {
    checks.push({ id: 'render', label: 'Semua keadaan bisa dirender', ok: false, detail: String(error instanceof Error ? error.message : error).slice(0, 300) });
    return { previews: [], checks, ready: false };
  }
  const previews: PreviewResult[] = cases.map((item, index) => {
    const first = rendered[index * 2];
    const svg = first?.svg && first.svg.length <= MARKUP_LIMIT ? first.svg : null;
    const error = first?.error ?? (first?.svg ? 'SVG is larger than the limit' : 'No output');
    return { key: item.key, label: item.label, variant: item.variant, svg, error: svg ? null : error };
  });

  const failed = previews.filter((preview) => !preview.svg);
  checks.push({ id: 'render', label: 'Semua keadaan bisa dirender', ok: failed.length === 0, detail: failed.map((preview) => `${preview.label}: ${preview.error}`).slice(0, 4).join(' · ') || undefined });

  const wrongCanvas = previews.filter((preview) => preview.svg && !/^<svg[^>]*viewBox="0 0 760 480"/.test(preview.svg));
  checks.push({ id: 'canvas', label: 'Kanvas 760×480 seperti aset lain', ok: wrongCanvas.length === 0, detail: wrongCanvas.map((preview) => preview.label).join(', ') || undefined });

  const broken = previews.filter((preview) => preview.svg && /NaN|Infinity|undefined/.test(preview.svg));
  checks.push({ id: 'numbers', label: 'Tidak ada angka rusak (NaN, Infinity)', ok: broken.length === 0, detail: broken.map((preview) => preview.label).join(', ') || undefined });

  const unstable = cases.filter((_, index) => rendered[index * 2]?.svg && rendered[index * 2].svg !== rendered[index * 2 + 1]?.svg && comparable(rendered[index * 2].svg!) !== comparable(rendered[index * 2 + 1]?.svg ?? ''));
  checks.push({ id: 'deterministic', label: 'Hasil sama setiap dirender', ok: unstable.length === 0, detail: unstable.map((item) => item.label).join(', ') || undefined });

  const variantMarkup = Object.keys(meta.variants).map((variant) => previews.find((preview) => preview.key === variant)?.svg).filter(Boolean).map((svg) => comparable(svg!));
  checks.push({ id: 'variants', label: 'Setiap varian tampil berbeda', ok: new Set(variantMarkup).size === variantMarkup.length });

  const baseOf = (variant: string) => comparable(previews.find((preview) => preview.key === variant)?.svg ?? '');
  const silent = previews.filter((preview) => preview.key.includes(':') && preview.svg && comparable(preview.svg) === baseOf(preview.variant));
  checks.push({ id: 'states', label: 'Setiap keadaan mengubah gambar', ok: silent.length === 0, detail: silent.map((preview) => preview.label).join(', ') || undefined });

  const outside = Object.entries(meta.variants).flatMap(([variant, info]) => Object.entries(info.anchors)
    .filter(([, point]) => {
      const p = projectAnchor(point);
      return p.x < 0 || p.x > DRAFT_CANVAS.width || p.y < 0 || p.y > DRAFT_CANVAS.height;
    })
    .map(([name]) => `${variant}.${name}`));
  checks.push({ id: 'anchors', label: 'Titik label berada di dalam gambar', ok: outside.length === 0, detail: outside.join(', ') || undefined });

  return { previews, checks, ready: checks.every((check) => check.ok) };
}
