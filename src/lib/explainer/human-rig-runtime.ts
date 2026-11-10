import vm from 'node:vm';
import React from 'react';
import { transform } from 'sucrase';
import { renderSvgMarkup } from '@/lib/assets/draft-runtime';
import { HUMAN_RIG_SOURCE } from './human-rig';

type Point = [number, number];
interface LimbJoints { hip: Point; knee: Point; ankle: Point; heel: Point; toe: Point; shoulder: Point; elbow: Point; wrist: Point; fingers: Point }

export interface HumanRigSolved {
  pose: Record<string, number>;
  pelvisY: number;
  metrics: Record<string, number>;
  joints: { pelvis: Point; neckBase: Point; headBase: Point; headTop: Point; near: LimbJoints; far: LimbJoints };
}

export interface HumanRigApi {
  metrics(height: number): Record<string, number>;
  stride(height: number): number;
  solve(height: number, options?: Record<string, unknown>): HumanRigSolved;
  walkPose(phase: number, height: number): Record<string, number>;
  walk(options: { progress: number; fromX: number; toX: number; height?: number; scale?: number }): { x: number; walkPhase: number; walkMix: number; facing: number };
  poses: string[];
  Rig: (props: Record<string, unknown>) => React.ReactElement;
}

let cached: { HUMAN_RIG: HumanRigApi; HumanRig: (props: Record<string, unknown>) => React.ReactElement } | null = null;

/** Evaluates the rig source in a VM with only React, the same way drafts run. For checks and tests. */
export function loadHumanRig() {
  if (cached) return cached;
  const compiled = transform(`${HUMAN_RIG_SOURCE}\n;__exports = { HUMAN_RIG, HumanRig };`, {
    transforms: ['jsx', 'typescript'], jsxRuntime: 'classic', production: true,
  }).code;
  const sandbox: Record<string, unknown> = { React, __exports: {} };
  vm.runInContext(compiled, vm.createContext(sandbox), { timeout: 1000, filename: 'HumanRig.js' });
  cached = sandbox.__exports as NonNullable<typeof cached>;
  return cached;
}

/** Poses a drafted character is checked and reviewed in. */
export const CHARACTER_CHECK_POSES: ReadonlyArray<{ label: string; props: Record<string, unknown> }> = [
  { label: 'stand', props: { pose: 'stand' } },
  // Scenes always pass walkMix with walkPhase (HUMAN_RIG.walk), so the check does too.
  { label: 'walk', props: { pose: 'stand', walkPhase: 0.15, walkMix: 1 } },
  { label: 'point', props: { pose: 'point' } },
];

/**
 * Renders one drafted character component on top of the rig source in a fresh VM, once per pose.
 * Code reaches this only after validateSceneCode, like every draft render.
 */
export function renderCharacterPoses(code: string, name: string): Array<{ label: string; svg: string | null; error: string | null }> {
  const compiled = transform(`${HUMAN_RIG_SOURCE}\n${code}\n;__exports = { ${name} };`, {
    transforms: ['jsx', 'typescript'], jsxRuntime: 'classic', production: true,
  }).code;
  const sandbox: Record<string, unknown> = {
    React,
    __exports: {},
    __render: (component: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>) => renderSvgMarkup(React.createElement(component, props)),
  };
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(compiled, context, { timeout: 1000, filename: `${name}.js` });
  const component = (sandbox.__exports as Record<string, unknown>)[name];
  return CHARACTER_CHECK_POSES.map(({ label, props }) => {
    try {
      if (typeof component !== 'function') throw new Error(`${name} is not a component`);
      sandbox.__current = component;
      sandbox.__props = props;
      const svg = String(vm.runInContext('__render(__current, __props)', context, { timeout: 1000, filename: `${name}-render.js` }));
      if (/NaN|Infinity|undefined/.test(svg)) throw new Error(`${name} renders broken numbers (NaN, Infinity, or undefined) in pose ${label}`);
      if (!/<(path|rect|circle|ellipse|polygon|polyline|line)\b/.test(svg)) throw new Error(`${name} renders no visible shapes in pose ${label}`);
      return { label, svg, error: null };
    } catch (error) {
      return { label, svg: null, error: String(error instanceof Error ? error.message : error).slice(0, 300) };
    }
  });
}
