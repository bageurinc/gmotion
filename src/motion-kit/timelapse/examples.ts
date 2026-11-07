/**
 * Curated few-shot scene examples for the AI Coder prompt.
 * These show the LLM how to combine generic primitives (StagedReveal, GrowAxis, StateMorph,
 * Repeat, PathMover, TimeHUD) to render any timelapse topic cleanly.
 */

export const TIMELAPSE_FEW_SHOT_EXAMPLES = `
### Timelapse Composition Examples for Any Subject

#### Example 1: Skyscraper Construction Timelapse (Building, Architecture, Engineering)
\`\`\`tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SceneLayout,
  SceneBackground,
  SceneStage,
  CameraRig,
  KineticHeadline,
  SyncedCaptions,
  StagedReveal,
  GrowAxis,
  PathMover,
  TimeHUD,
  useTimelapseProgress,
} from '@/motion-kit';

export const SceneConstruction: React.FC<{ palette?: any }> = ({ palette }) => {
  const progress = useTimelapseProgress();
  const floorCount = 12;

  return (
    <SceneLayout>
      <SceneBackground>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, #1E293B, #0F172A)' }} />
      </SceneBackground>

      <KineticHeadline
        text="Konstruksi Megah 12 Lantai"
        highlightWords={["Megah", "Lantai"]}
        highlightColor="#38BDF8"
        badgeText="TIMELAPSE PROGRES"
      />

      <SceneStage>
        <CameraRig mode="timelapse" fromScale={1.0} toScale={1.03}>
          <svg viewBox="0 0 800 1000" style={{ width: '100%', height: '100%' }}>
            {/* Ground / Foundation */}
            <rect x="150" y="880" width="500" height="40" fill="#334155" rx="4" />

            {/* Foundation Piling via GrowAxis */}
            <GrowAxis axis="y" progress={progress} fromProgress={0} toProgress={0.2} origin="bottom center">
              <rect x="240" y="840" width="320" height="40" fill="#475569" />
            </GrowAxis>

            {/* Rising Floors via StagedReveal */}
            <StagedReveal
              count={floorCount}
              from={0.15}
              to={0.88}
              progress={progress}
              containerTag="g"
              renderItem={(index, itemProg) => {
                const floorY = 820 - index * 52;
                return (
                  <g key={index} opacity={itemProg} transform={\`translate(0, \${(1 - itemProg) * 20})\`}>
                    {/* Concrete Floor Slab */}
                    <rect x="250" y={floorY} width="300" height="48" fill="#1E293B" stroke="#0284C7" strokeWidth="2" rx="3" />
                    {/* Glowing Windows */}
                    {[270, 330, 390, 450, 510].map((wx) => (
                      <rect key={wx} x={wx} y={floorY + 10} width="36" height="28" fill="#38BDF8" opacity={0.7 * itemProg} rx="2" />
                    ))}
                  </g>
                );
              }}
            />

            {/* Tower Crane Moving Horizontally via PathMover */}
            <PathMover from={{ x: 200, y: 180 }} to={{ x: 500, y: 180 }} progress={progress}>
              <line x1="0" y1="0" x2="160" y2="0" stroke="#F59E0B" strokeWidth="4" />
              <line x1="80" y1="0" x2="80" y2="100" stroke="#F59E0B" strokeWidth="3" />
              <circle cx="80" cy="0" r="8" fill="#EF4444" />
            </PathMover>
          </svg>

          {/* Neutral Progress HUD */}
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <TimeHUD mode="bar" label="Pembangunan Gedung" fromLabel="Lantai 1" toLabel="Lantai 12" accentColor="#38BDF8" />
          </div>
        </CameraRig>
      </SceneStage>
    </SceneLayout>
  );
};
\`\`\`

#### Example 2: Plant Growth Timelapse (Nature, Botany, Agriculture)
\`\`\`tsx
import React from 'react';
import {
  SceneLayout,
  SceneBackground,
  SceneStage,
  CameraRig,
  KineticHeadline,
  GrowAxis,
  StagedReveal,
  StateMorph,
  TimeHUD,
  useTimelapseProgress,
} from '@/motion-kit';

export const ScenePlantGrowth: React.FC<{ palette?: any }> = () => {
  const progress = useTimelapseProgress();

  return (
    <SceneLayout>
      <SceneBackground>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, #064E3B, #022C22)' }} />
      </SceneBackground>

      <KineticHeadline text="Pertumbuhan Dari Sebutir Benih" highlightWords={["Benih", "Tumbuh"]} highlightColor="#10B981" />

      <SceneStage>
        <CameraRig mode="timelapse">
          <svg viewBox="0 0 600 800" style={{ width: '100%', height: '100%' }}>
            {/* Soil */}
            <ellipse cx="300" cy="720" rx="220" ry="40" fill="#78350F" />

            {/* Stem Growing Upward via GrowAxis */}
            <GrowAxis axis="y" origin="bottom center" progress={progress} fromProgress={0.05} toProgress={0.65}>
              <path d="M 300 700 Q 295 500 300 350" stroke="#10B981" strokeWidth="12" strokeLinecap="round" fill="none" />
            </GrowAxis>

            {/* Leaves Sprouting via StagedReveal */}
            <StagedReveal
              count={6}
              from={0.25}
              to={0.8}
              progress={progress}
              containerTag="g"
              renderItem={(i, p) => {
                const side = i % 2 === 0 ? 1 : -1;
                const ly = 620 - i * 45;
                return (
                  <ellipse
                    key={i}
                    cx={300 + side * 40 * p}
                    cy={ly}
                    rx={32 * p}
                    ry={14 * p}
                    fill="#34D399"
                    transform={\`rotate(\${side * 25} \${300 + side * 40 * p} \${ly})\`}
                  />
                );
              }}
            />

            {/* Flower Blooming via StateMorph */}
            <StateMorph
              progress={progress}
              states={[
                { at: 0.6, scale: 0.1, color: '#047857' },
                { at: 0.85, scale: 0.7, color: '#FBBF24' },
                { at: 1.0, scale: 1.2, color: '#EF4444' },
              ]}
            >
              {({ color, scale }) => (
                <g transform={\`translate(300, 330) scale(\${scale})\`}>
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <circle key={deg} cx={Math.cos((deg * Math.PI) / 180) * 25} cy={Math.sin((deg * Math.PI) / 180) * 25} r="18" fill={color} />
                  ))}
                  <circle cx="0" cy="0" r="16" fill="#FEF08A" />
                </g>
              )}
            </StateMorph>
          </svg>

          <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <TimeHUD mode="bar" label="Pertumbuhan Benih" fromLabel="Hari 1" toLabel="Hari 30" accentColor="#10B981" />
          </div>
        </CameraRig>
      </SceneStage>
    </SceneLayout>
  );
};
\`\`\`
`;
