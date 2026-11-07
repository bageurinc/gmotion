import { transformSync } from 'esbuild';
import { transform } from 'sucrase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ALLOWED_IMPORTS = [
  'react',
  'remotion',
  'lucide-react',
  '@/motion-kit',
  '@/types/studio',
];

export function validateSceneCode(code: string, fileName = 'Scene.tsx'): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check for forbidden imports
  const importLines = code.match(/import\s+.*?from\s+['"][^'"]+['"]/g) || [];
  for (const line of importLines) {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (match) {
      const moduleName = match[1];
      const isAllowed =
        ALLOWED_IMPORTS.includes(moduleName) ||
        moduleName.startsWith('./') ||
        moduleName.startsWith('../');

      if (!isAllowed) {
        errors.push(
          `Forbidden import '${moduleName}' in ${fileName}. Only 'react', 'remotion', 'lucide-react', and '@/motion-kit' are permitted.`
        );
      }
    }
  }

  // 2. Check for Remotion anti-patterns
  if (code.includes('Math.random()')) {
    errors.push(
      `Detected 'Math.random()' in ${fileName}. Remotion requires deterministic rendering. Replace with Remotion's 'random(seed)'.`
    );
  }

  if (code.includes('Date.now()')) {
    errors.push(
      `Detected 'Date.now()' in ${fileName}. Remotion requires deterministic rendering. Animate with useTimelapseProgress() or useCurrentFrame().`
    );
  }

  if (code.includes('setTimeout') || code.includes('setInterval')) {
    errors.push(
      `Detected timer functions ('setTimeout' / 'setInterval') in ${fileName}. Use 'useCurrentFrame()' and frame-based calculations instead.`
    );
  }

  if (/transition:\s*['"][^'"]+['"]/.test(code) || /animation:\s*['"][^'"]+['"]/.test(code)) {
    warnings.push(
      `Detected CSS transitions/animations in ${fileName}. Remotion videos should animate using 'interpolate()' or 'spring()' with 'useCurrentFrame()'.`
    );
  }

  // 3. Test compilation with Sucrase
  try {
    transform(code, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Sucrase compilation error in ${fileName}: ${errorMsg}`);
  }

  // 4. Exports compile with esbuild, which is stricter than the browser preview.
  try {
    transformSync(code, { loader: 'tsx', logLevel: 'silent' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Export compilation error in ${fileName}: ${errorMsg}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
