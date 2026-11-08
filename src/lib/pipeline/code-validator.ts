import { parse } from 'acorn';
import { transformSync } from 'esbuild';
import { transform } from 'sucrase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface AstNode {
  type: string;
  [key: string]: unknown;
}

const ALLOWED_IMPORTS = new Set(['react', 'remotion', 'lucide-react', '@/motion-kit', '@/types/studio']);

const TIMER_GLOBALS = new Set(['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame']);

/** Browser and runtime capabilities that a video scene never needs. */
const FORBIDDEN_GLOBALS = new Set([
  'eval', 'Function', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker',
  'window', 'document', 'globalThis', 'self', 'top', 'parent', 'frames', 'opener',
  'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'cookieStore',
  'require', 'process', 'module', 'postMessage', 'importScripts',
]);

const FORBIDDEN_PROPERTIES = new Set([
  'constructor', '__proto__', 'prototype', 'cookie', 'innerHTML', 'outerHTML', 'insertAdjacentHTML',
  'dangerouslySetInnerHTML',
]);

const FORBIDDEN_ELEMENTS = new Set([
  'script', 'iframe', 'object', 'embed', 'foreignObject', 'link', 'meta', 'base', 'form', 'style',
]);

const URL_PROPERTIES = new Set(['src', 'href', 'xlinkHref', 'srcDoc', 'action', 'formAction']);
const EXTERNAL_URL = /^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';

function childNodes(node: AstNode): AstNode[] {
  return Object.values(node).flatMap((value) => (Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : []));
}

function walk(node: AstNode, visit: (node: AstNode, parent: AstNode | null) => void, parent: AstNode | null = null) {
  visit(node, parent);
  for (const child of childNodes(node)) walk(child, visit, node);
}

function patternNames(pattern: unknown, names: Set<string>) {
  if (!isNode(pattern)) return;
  if (pattern.type === 'Identifier') names.add(pattern.name as string);
  if (pattern.type === 'Property') return patternNames(pattern.value, names);
  if (pattern.type === 'AssignmentPattern') return patternNames(pattern.left, names);
  if (pattern.type === 'RestElement') return patternNames(pattern.argument, names);
  for (const child of childNodes(pattern)) patternNames(child, names);
}

function declaredNames(ast: AstNode): Set<string> {
  const names = new Set<string>();
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator') patternNames(node.id, names);
    if (node.type === 'CatchClause') patternNames(node.param, names);
    if (['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(node.type)) {
      patternNames(node.local, names);
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      patternNames(node.id, names);
      (node.params as unknown[]).forEach((param) => patternNames(param, names));
    }
    if (node.type === 'ClassDeclaration') patternNames(node.id, names);
  });
  return names;
}

/** True when an identifier is a property name or label, not a variable reference. */
function isNameOnly(node: AstNode, parent: AstNode | null): boolean {
  if (!parent) return false;
  if (parent.type === 'MemberExpression') return parent.property === node && !parent.computed;
  if (parent.type === 'Property' || parent.type === 'MethodDefinition') return parent.key === node && !parent.computed;
  return ['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ExportSpecifier'].includes(parent.type);
}

function memberName(node: AstNode): string | null {
  const property = node.property as AstNode;
  if (!node.computed && property.type === 'Identifier') return property.name as string;
  return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
}

function isElementFactory(node: AstNode): boolean {
  const callee = node.callee as AstNode;
  return callee.type === 'MemberExpression' && memberName(callee) === 'createElement';
}

function isAllowedImport(source: string): boolean {
  return ALLOWED_IMPORTS.has(source) || source.startsWith('./') || source.startsWith('../');
}

function inspectAst(ast: AstNode, fileName: string, errors: string[], svgOnly: boolean) {
  const declared = declaredNames(ast);
  const report = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };

  walk(ast, (node, parent) => {
    if (svgOnly && node.type === 'ImportSpecifier') {
      const imported = node.imported as AstNode;
      if (['Img', 'Image', 'ImageStage', 'Video', 'OffthreadVideo', 'AnimatedImage'].includes(String(imported.name ?? imported.value))) {
        report(`Full SVG does not allow image or video imports in ${fileName}.`);
      }
    }
    if (svgOnly && node.type === 'Literal' && typeof node.value === 'string') {
      const imageUrl = [...node.value.matchAll(/url\s*\(([^)]*)\)/gi)]
        .some((match) => !match[1].trim().replace(/^["']/, '').startsWith('#'));
      if (imageUrl || /(?:\.(?:png|jpe?g|webp|gif|avif|bmp)(?:[?#]|$)|data:image)/i.test(node.value)) {
        report(`Full SVG does not allow image assets or CSS image URLs in ${fileName}.`);
      }
    }

    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const source = (node.source as AstNode | null)?.value;
      if (typeof source === 'string' && !isAllowedImport(source)) {
        report(`Forbidden import '${source}' in ${fileName}. Only 'react', 'remotion', 'lucide-react', and '@/motion-kit' are permitted.`);
      }
    }

    if (node.type === 'ImportExpression') report(`Dynamic import is forbidden in ${fileName}.`);
    if (node.type === 'MetaProperty') report(`import.meta is forbidden in ${fileName}.`);

    if (node.type === 'MemberExpression') {
      const name = memberName(node);
      const object = node.object as AstNode;
      if (object.type === 'Identifier' && object.name === 'Math' && name === 'random') {
        report(`Detected 'Math.random()' in ${fileName}. Remotion requires deterministic rendering. Replace with Remotion's 'random(seed)'.`);
      }
      if (object.type === 'Identifier' && object.name === 'Date' && name === 'now') {
        report(`Detected 'Date.now()' in ${fileName}. Remotion requires deterministic rendering. Animate with useTimelapseProgress() or useCurrentFrame().`);
      }
      if (name && FORBIDDEN_PROPERTIES.has(name)) report(`Forbidden property '${name}' in ${fileName}.`);
    }

    if (node.type === 'Identifier' && !isNameOnly(node, parent) && !declared.has(node.name as string)) {
      const name = node.name as string;
      if (TIMER_GLOBALS.has(name)) {
        report(`Detected timer functions ('${name}') in ${fileName}. Use 'useCurrentFrame()' and frame-based calculations instead.`);
      }
      if (FORBIDDEN_GLOBALS.has(name)) report(`Forbidden global '${name}' in ${fileName}.`);
    }

    if (node.type === 'CallExpression' && isElementFactory(node)) {
      const element = (node.arguments as AstNode[])[0];
      if (element?.type === 'Literal' && (FORBIDDEN_ELEMENTS.has(element.value as string) || (svgOnly && ['img', 'image', 'video', 'canvas', 'feImage'].includes(String(element.value))))) {
        report(`Forbidden element <${element.value}> in ${fileName}.`);
      }
    }

    if (node.type === 'Property') {
      const key = node.key as AstNode;
      const value = node.value as AstNode;
      const name = (key.name ?? key.value) as string;
      if (FORBIDDEN_PROPERTIES.has(name)) report(`Forbidden property '${name}' in ${fileName}.`);
      if (URL_PROPERTIES.has(name) && value.type === 'Literal' && EXTERNAL_URL.test(String(value.value))) {
        report(`External URL in '${name}' is forbidden in ${fileName}.`);
      }
    }
  });
}

export function validateSceneCode(code: string, fileName = 'Scene.tsx', options: { svgOnly?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    transform(code, { transforms: ['jsx', 'typescript', 'imports'], jsxRuntime: 'classic' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Sucrase compilation error in ${fileName}: ${errorMsg}`);
  }

  // Exports compile with esbuild, which is stricter than the browser preview.
  try {
    const { code: javascript } = transformSync(code, {
      loader: 'tsx',
      format: 'esm',
      logLevel: 'silent',
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    });
    inspectAst(parse(javascript, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as AstNode, fileName, errors, options.svgOnly ?? false);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Export compilation error in ${fileName}: ${errorMsg}`);
  }

  if (/transition:\s*['"][^'"]+['"]/.test(code) || /animation:\s*['"][^'"]+['"]/.test(code)) {
    warnings.push(
      `Detected CSS transitions/animations in ${fileName}. Remotion videos should animate using 'interpolate()' or 'spring()' with 'useCurrentFrame()'.`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
