'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Remotion from 'remotion';
import * as MotionKit from '@/motion-kit';
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
    if (path === 'react') return React as unknown as Record<string, unknown>;
    if (path === 'remotion') return Remotion as unknown as Record<string, unknown>;
    if (path === '@/motion-kit' || path === './motion-kit' || path === '../motion-kit') return MotionKit as unknown as Record<string, unknown>;
    if (path === 'lucide-react') return LucideIcons as unknown as Record<string, unknown>;

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
      return {};
    }

    if (moduleCache[matchedKey]) {
      return moduleCache[matchedKey].exports;
    }

    const code = files[matchedKey];
    const transformed = transform(code, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
    }).code;

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
      throw new Error(`Failed to compile ${matchedKey}: ${errorMsg}`);
    }

    return vModule.exports;
  }

  try {
    const entryModule = virtualRequire(entryFile);
    const Comp = (entryModule.default || entryModule.MainVideo || Object.values(entryModule)[0]) as React.ComponentType<Record<string, unknown>>;

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
        }}
      >
        <h3>Compilation Error</h3>
        <pre style={{ color: '#F87171', fontSize: 13 }}>{errorMsg}</pre>
      </div>
    );
    ErrorFallback.displayName = 'ErrorFallback';
    return ErrorFallback;
  }
}
