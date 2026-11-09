'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Remotion from 'remotion';
import * as MotionKit from '@/motion-kit';
import * as DraftKit from '@/motion-kit/isometric/draft-kit';
import * as LucideIcons from 'lucide-react';
import { transform } from 'sucrase';
import { VirtualFileMap } from '@/types/studio';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SceneErrorBoundary] Caught runtime error in scene:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo!);
      }

      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0F172A',
            color: '#EF4444',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            fontFamily: 'monospace',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              borderRadius: 16,
              padding: 24,
              maxWidth: '90%',
            }}
          >
            <h3 style={{ fontSize: 20, margin: '0 0 12px 0', fontWeight: 'bold' }}>
              ⚠️ Scene Render Error
            </h3>
            <p style={{ color: '#F87171', fontSize: 14, margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message || 'Unknown runtime error'}
            </p>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              Check your scene TSX syntax or ask AI Co-Director to auto-heal.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * In-Memory Virtual Module Compiler using Sucrase (< 15ms)
 */
export function compileVirtualProject(
  files: VirtualFileMap,
  entryFile = 'MainVideo.tsx'
): React.FC {
  type VirtualModule = { exports: Record<string, unknown> };
  const moduleCache: Record<string, VirtualModule> = {};

  function virtualRequire(path: string): Record<string, unknown> {
    // 1. External dependencies injection
    if (path === 'react') {
      return { ...React, default: React } as unknown as Record<string, unknown>;
    }
    if (path === 'remotion') {
      return { ...Remotion, default: Remotion } as unknown as Record<string, unknown>;
    }
    if (
      path === '@/motion-kit' ||
      path === './motion-kit' ||
      path === '../motion-kit' ||
      path === 'motion-kit'
    ) {
      return new Proxy(MotionKit, {
        get(target, prop: string) {
          if (prop in target) {
            return (target as Record<string, unknown>)[prop];
          }
          console.warn(`[VirtualCompiler] Component '${prop}' not found in @/motion-kit. Providing safe fallback.`);
          const FallbackComponent: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
            React.createElement('div', { 'data-missing-kit': prop, style: { position: 'relative', ...style } }, children)
          );
          FallbackComponent.displayName = `MissingKit(${prop})`;
          return FallbackComponent;
        },
      }) as unknown as Record<string, unknown>;
    }
    // Published library assets import only React and the draft kit.
    if (path === '@/motion-kit/isometric/draft-kit') {
      return DraftKit as unknown as Record<string, unknown>;
    }
    if (path === 'lucide-react') {
      return new Proxy(LucideIcons, {
        get(target, prop: string) {
          if (prop in target) {
            return (target as Record<string, unknown>)[prop];
          }
          const FallbackIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = (props) => (
            React.createElement('span', { style: { display: 'inline-block', ...props.style } }, '✨')
          );
          FallbackIcon.displayName = `FallbackIcon(${prop})`;
          return FallbackIcon;
        },
      }) as unknown as Record<string, unknown>;
    }

    // 2. Relative virtual files
    const cleanPath = path.replace(/^\.\//, '').replace(/\.(tsx|ts|jsx|js)$/, '');
    const possibleKeys = [
      `${cleanPath}.tsx`,
      `${cleanPath}.ts`,
      cleanPath,
      `${cleanPath}.jsx`,
      `${cleanPath}.js`,
    ];

    const matchedKey = possibleKeys.find((k) => files[k] !== undefined);
    if (!matchedKey) {
      console.warn(`[VirtualCompiler] Module not found: ${path}. Available files:`, Object.keys(files));
      const EmptyFallback = () => null;
      return { default: EmptyFallback, __esModule: true };
    }

    if (moduleCache[matchedKey]) {
      return moduleCache[matchedKey].exports;
    }

    const code = files[matchedKey];
    let transformed = '';
    try {
      transformed = transform(code, {
        transforms: ['jsx', 'typescript', 'imports'],
        jsxRuntime: 'classic',
      }).code;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[VirtualCompiler] Sucrase transform error in ${matchedKey}:`, err);
      throw new Error(`Syntax error in ${matchedKey}: ${errorMsg}`);
    }

    const vModule: VirtualModule = { exports: {} };
    moduleCache[matchedKey] = vModule;

    try {
      const runModule = new Function(
        'React',
        'require',
        'module',
        'exports',
        transformed
      );
      runModule(React, virtualRequire, vModule, vModule.exports);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[VirtualCompiler] Error executing virtual module ${matchedKey}:`, err);
      throw new Error(`Failed to execute ${matchedKey}: ${errorMsg}`);
    }

    // 3. Normalize exports: Ensure both default and named exports exist
    const nonEsKeys = Object.keys(vModule.exports).filter((k) => k !== '__esModule');

    if (!vModule.exports.default && nonEsKeys.length > 0) {
      const matchedNamed = nonEsKeys.find(
        (k) =>
          cleanPath.toLowerCase().endsWith(k.toLowerCase()) ||
          k.toLowerCase().endsWith(cleanPath.toLowerCase())
      );

      if (matchedNamed && typeof vModule.exports[matchedNamed] === 'function') {
        vModule.exports.default = vModule.exports[matchedNamed];
      } else {
        const firstFn = nonEsKeys.map((k) => vModule.exports[k]).find((v) => typeof v === 'function');
        if (firstFn) {
          vModule.exports.default = firstFn;
        } else {
          vModule.exports.default = vModule.exports[nonEsKeys[0]];
        }
      }
    }

    // Also ensure named export exists matching file/component name if default export is present
    if (vModule.exports.default && typeof vModule.exports.default === 'function') {
      const compFn = vModule.exports.default as { name?: string };
      const compName = compFn.name || cleanPath;
      if (compName && !vModule.exports[compName]) {
        vModule.exports[compName] = vModule.exports.default;
      }
    }

    return vModule.exports;
  }

  try {
    const entryModule = virtualRequire(entryFile);
    const Comp = (entryModule.default ||
      entryModule.MainVideo ||
      Object.values(entryModule).find((v) => typeof v === 'function')) as React.ComponentType<Record<string, unknown>>;

    if (!Comp || typeof Comp !== 'function') {
      throw new Error(`Entry file '${entryFile}' did not export a valid React component.`);
    }

    const SafeComp: React.FC<Record<string, unknown>> = (props) => (
      <SceneErrorBoundary>
        <Comp {...props} />
      </SceneErrorBoundary>
    );
    SafeComp.displayName = 'SafeComp';

    return SafeComp as React.FC;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[VirtualCompiler] Fatal compilation error:', err);
    const ErrorFallback: React.FC = () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#090D16',
          color: '#EF4444',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 'bold' }}>⚠️ Kompilasi Video Gagal</h3>
        <pre style={{ color: '#F87171', fontSize: 12, maxWidth: '90%', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {errorMsg}
        </pre>
      </div>
    );
    ErrorFallback.displayName = 'ErrorFallback';
    return ErrorFallback;
  }
}
