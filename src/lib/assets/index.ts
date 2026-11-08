export type { AssetEntry, AssetPoint, AssetPropSpec, AssetVariant, AssetStatus, AssetRendererKey } from './types';
export { ASSET_REGISTRY, getAsset, registrySnapshot } from './registry';
export {
  AssetPlanSchema, PLAN_LIMITS, VisualPolicySchema, validateAssetPlan, variantPropsSchema, resolveInstanceProps,
} from './plan-schema';
export type { AssetPlan, AssetPlanInstance, AssetPlanResult, VisualPolicy } from './plan-schema';
export { findAssets, describeForPrompt } from './catalog';
export type { CatalogMatch } from './catalog';
