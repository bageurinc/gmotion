'use client';

export * from './core/CameraRig';
export * from './core/KineticHeadline';
export * from './core/DataCard';
export * from './core/SyncedCaptions';
export { TextStyleProvider } from './core/TextStyleContext';
export * from './core/VideoTimeline';
export { SceneLayout, SceneStage, SceneBackground } from './core/SafeOverlay';
export * from './ads/PhoneMockup';
export * from './ads/WhatsAppChatSim';
export * from './ads/MetricsDashboard';
export * from './ads/PulseCTAButton';
export * from './story/ParallaxWorld';
export * from './story/TimelapseClock';
export * from './explainer/AssetStage';
export * from './explainer/ImageStage';
export * from './explainer/image-camera';
export * from './world/IsoVideo';
export * from './timelapse/primitives';
export * from './timelapse/examples';
export * from './docs';
export * from './world/IsoPicture';
export * from './isometric';

// Library videos: the plan renderer and the code asset catalog it starts from.
export { PlanVideo, planDurationInFrames } from './assets/PlanVideo';
export { WorldPlanVideo } from './assets/WorldPlanVideo';
export { ASSET_REGISTRY as LIBRARY_ASSETS } from '@/lib/assets/registry';
