import { generateText } from 'ai';
import { getCoderModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { Storyboard, SceneSpec, VirtualFileMap, AspectRatioDimensions } from '@/types/studio';
import { MOTION_KIT_PROMPT_DOCS } from '@/motion-kit/docs';
import { TIMELAPSE_FEW_SHOT_EXAMPLES } from '@/motion-kit/timelapse/examples';
import { validateSceneCode } from './code-validator';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from './concurrency';

const CODER_SYSTEM_PROMPT = `
You are an expert Remotion & React developer specializing in high-converting motion graphics and SVG animations.

Your task is to write a single self-contained React component for a Remotion scene.

${MOTION_KIT_PROMPT_DOCS}

CRITICAL RULES:
1. ONLY import from:
   - 'react' (React, useMemo, etc.)
   - 'remotion' (useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random, Sequence)
   - '@/motion-kit' (SceneLayout, SceneBackground, SceneStage, CameraRig, KineticHeadline, SyncedCaptions, PhoneMockup, WhatsAppChatSim, MetricCard, AnimatedCounter, TrendLineChart, PulseCTAButton, ParallaxWorld, SvgParticles, DayNightSky, TimelapseClock, TimelapseProgress, TimelapseShadow, useTimelapseProgress, StagedReveal, GrowAxis, StateMorph, Repeat, PathMover, TimeHUD)
   - 'lucide-react'
2. Export the component as default or named export matching the scene component name (e.g. export const Scene1: React.FC<SceneProps> = ...).
3. Do NOT use Math.random() or Date.now().
4. Do NOT use CSS keyframes or transition property. Animate via useCurrentFrame() with interpolate() or spring().
5. Output ONLY clean TypeScript/TSX code inside markdown codeblocks (\`\`\`tsx ... \`\`\`).
`;

/**
 * Procedural fallback code generator for Ads UI scenes
 */
export function generateProceduralAdsSceneCode(scene: SceneSpec, index: number): string {
  if (scene.role === 'narrative') return generateProceduralStorySceneCode(scene, index);
  const sceneNum = index + 1;
  const compName = `Scene${sceneNum}`;

  if (scene.role === 'hook') {
    return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  PhoneMockup,
  WhatsAppChatSim,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const chatMessages = [
    {
      id: '1',
      sender: 'customer' as const,
      text: 'Halo kak, promo paketnya masih ada slot?',
      time: '09:41',
      delayFrames: 5,
    },
    {
      id: '2',
      sender: 'customer' as const,
      text: 'Kak? Mau transfer sekarang nih...',
      time: '11:15',
      delayFrames: 30,
      status: 'ghosted' as const,
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#090D16',
        color: palette?.text || '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="macro-zoom-in" fromScale={0.96} toScale={1.08} targetY={-30}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 120,
            gap: 36,
            height: '100%',
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Ghosting', 'di-Ghosting', 'Chat']}
            highlightColor={palette?.alert || '#EF4444'}
            badgeText="STOP LOSS REVENUE"
            badgeTextColor={palette?.alert || '#EF4444'}
            fontSize={50}
          />

          <PhoneMockup
            width={420}
            height={780}
            glowColor={palette?.alert || '#EF4444'}
            floatingBadge={{
              text: 'Loss Rp 4.5 Juta/Hari',
              subtext: 'Akibat Chat Telat Dibalas',
              icon: 'bell',
              position: 'top-right',
            }}
          >
            <WhatsAppChatSim
              contactName="Calon Buyer (Urgent)"
              contactStatus="Online 2 jam lalu"
              messages={chatMessages}
              showGhostingAlert={frame > 45}
            />
          </PhoneMockup>
        </div>
      </CameraRig>

      <SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.secondary || '#38BDF8'}
        bottomOffset={180}
      />
    </div>
  );
};

export default ${compName};
`;
  }

  if (scene.role === 'mechanism') {
    return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  PhoneMockup,
  WhatsAppChatSim,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  const frame = useCurrentFrame();

  const chatMessages = [
    {
      id: '1',
      sender: 'customer' as const,
      text: 'Halo, saya mau pesan paket business pro sekarang!',
      time: '09:41',
      delayFrames: 0,
    },
    {
      id: '2',
      sender: 'ai' as const,
      text: 'Siap kak! Invoice #8492 sudah dibuat & kupon 30% aktif ya ⚡',
      time: '09:41',
      delayFrames: 12,
      status: 'read' as const,
    },
    {
      id: '3',
      sender: 'customer' as const,
      text: 'Wah cepat banget! Sudah saya transfer ya 👍',
      time: '09:42',
      delayFrames: 45,
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#090D16',
        color: palette?.text || '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="tilt-3d" fromScale={1.0} toScale={1.12}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 120,
            gap: 36,
            height: '100%',
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Kilat', '0.5 Detik', 'Otomatis']}
            highlightColor={palette?.primary || '#10B981'}
            badgeText="SMART AI CHATBOT"
            badgeTextColor={palette?.primary || '#10B981'}
            fontSize={50}
          />

          <PhoneMockup
            width={420}
            height={780}
            glowColor={palette?.primary || '#10B981'}
            floatingBadge={{
              text: 'Auto-Closing 0.5s',
              subtext: 'Tanpa Admin Manual',
              icon: 'bot',
              position: 'top-left',
            }}
          >
            <WhatsAppChatSim
              contactName="Customer VIP"
              contactStatus="Online"
              messages={chatMessages}
              showTypingAfterFrame={6}
            />
          </PhoneMockup>
        </div>
      </CameraRig>

      <SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#10B981'}
        bottomOffset={180}
      />
    </div>
  );
};

export default ${compName};
`;
  }

  if (scene.role === 'proof') {
    return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  MetricCard,
  TrendLineChart,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#090D16',
        color: palette?.text || '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="slow-push" fromScale={1.0} toScale={1.14}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 120,
            gap: 40,
            height: '100%',
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['320%', 'Omzet', 'Naik']}
            highlightColor={palette?.primary || '#10B981'}
            badgeText="PROVEN SALES RESULTS"
            badgeTextColor={palette?.primary || '#10B981'}
            fontSize={50}
          />

          <div style={{ width: '88%', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <MetricCard
              label="Kenaikan Closing Rate"
              value={320}
              suffix="%"
              changePercent={320}
              color={palette?.primary || '#10B981'}
            />

            <TrendLineChart
              data={[18, 28, 35, 52, 78, 110, 165]}
              peakLabel="Omzet Rp 120.000.000"
              lineColor={palette?.secondary || '#38BDF8'}
              width={520}
              height={280}
            />
          </div>
        </div>
      </CameraRig>

      <SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#10B981'}
        bottomOffset={180}
      />
    </div>
  );
};

export default ${compName};
`;
  }

  // CTA Scene
  return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  PulseCTAButton,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#090D16',
        color: palette?.text || '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="slow-push" fromScale={0.98} toScale={1.12}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 48,
            paddingBottom: 120,
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Gratis', 'Sekarang']}
            highlightColor={palette?.primary || '#10B981'}
            badgeText="LIMITED TIME OFFER"
            badgeTextColor={palette?.primary || '#10B981'}
            fontSize={54}
          />

          <PulseCTAButton
            buttonText="Coba Gratis 14 Hari"
            subtext="Klik Link di Bio / DM Kami Sekarang"
            bgColor={palette?.primary || '#10B981'}
            glowColor={palette?.primary || '#10B981'}
          />
        </div>
      </CameraRig>

      <SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#10B981'}
        bottomOffset={180}
      />
    </div>
  );
};

export default ${compName};
`;
}

/**
 * Procedural fallback code generator for 2D Illustrated Story scenes
 */
export function generateProceduralStorySceneCode(scene: SceneSpec, index: number): string {
  const sceneNum = index + 1;
  const compName = `Scene${sceneNum}`;

  if (scene.cameraAction === 'timelapse' || scene.timelapse) {
    const fromLabel = scene.timelapse?.fromLabel || 'Awal';
    const toLabel = scene.timelapse?.toLabel || 'Selesai';
    const textContext = `${scene.title} ${scene.kineticHeadline} ${scene.visualPrompt}`.toLowerCase();
    const isConstruction = /gedung|bangun|konstruksi|lantai|tower|arsitektur|building|skyscraper/i.test(textContext);
    const isPlant = /tanaman|pohon|bunga|tumbuh|benih|plant|tree|flower/i.test(textContext);
    const isDayNight = scene.timelapse?.kind === 'day-night' || /langit|matahari|siang ke malam|fajar|senja|sunset|sunrise|bintang|bulan/i.test(textContext);

    if (isConstruction) {
      return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  StagedReveal,
  GrowAxis,
  PathMover,
  TimeHUD,
  SyncedCaptions,
  useTimelapseProgress,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  const progress = useTimelapseProgress();
  const floorCount = 10;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#0F172A',
        color: palette?.text || '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="timelapse" fromScale={1.0} toScale={1.03}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 24,
            paddingBottom: 60,
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Konstruksi', 'Lantai', 'Gedung', 'Megah', 'Pondasi']}
            highlightColor={palette?.primary || '#38BDF8'}
            badgeText="TIMELAPSE KONSTRUKSI"
            badgeTextColor={palette?.secondary || '#0284C7'}
            fontSize={46}
          />

          <div style={{ width: '80%', height: 440, position: 'relative' }}>
            <svg viewBox="0 0 600 700" style={{ width: '100%', height: '100%' }}>
              {/* Foundation via GrowAxis */}
              <GrowAxis axis="y" progress={progress} fromProgress={0} toProgress={0.2} origin="bottom center">
                <rect x="150" y="620" width="300" height="40" fill="#334155" rx="4" />
              </GrowAxis>

              {/* Floors via StagedReveal */}
              <StagedReveal
                count={floorCount}
                from={0.15}
                to={0.88}
                progress={progress}
                containerTag="g"
                renderItem={(idx, itemProg) => {
                  const floorY = 570 - idx * 48;
                  return (
                    <g key={idx} opacity={itemProg} transform={\`translate(0, \${(1 - itemProg) * 16})\`}>
                      <rect x="180" y={floorY} width="240" height="44" fill="#1E293B" stroke="#0284C7" strokeWidth="2" rx="3" />
                      {[200, 250, 300, 350].map((wx) => (
                        <rect key={wx} x={wx} y={floorY + 10} width="32" height="24" fill="#38BDF8" opacity={0.7 * itemProg} rx="2" />
                      ))}
                    </g>
                  );
                }}
              />

              {/* Tower Crane Moving via PathMover */}
              <PathMover from={{ x: 140, y: 80 }} to={{ x: 380, y: 80 }} progress={progress}>
                <line x1="0" y1="0" x2="120" y2="0" stroke="#F59E0B" strokeWidth="4" />
                <line x1="60" y1="0" x2="60" y2="80" stroke="#F59E0B" strokeWidth="3" />
                <circle cx="60" cy="0" r="6" fill="#EF4444" />
              </PathMover>
            </svg>
          </div>

          <TimeHUD
            mode="bar"
            label="Progres Pembangunan"
            fromLabel="${fromLabel}"
            toLabel="${toLabel}"
            accentColor={palette?.primary || '#38BDF8'}
            style={{ width: 360 }}
          />
        </div>
      </CameraRig>

      ${scene.voiceoverText ? `<SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#38BDF8'}
        bottomOffset={180}
      />` : ''}
    </div>
  );
};

export default ${compName};
`;
    }

    if (isPlant) {
      return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  GrowAxis,
  StagedReveal,
  StateMorph,
  TimeHUD,
  SyncedCaptions,
  useTimelapseProgress,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  const progress = useTimelapseProgress();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#022C22',
        color: palette?.text || '#ECFDF5',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="timelapse" fromScale={1.0} toScale={1.04}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 24,
            paddingBottom: 60,
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Tumbuh', 'Benih', 'Alami', 'Bunga', 'Tanaman']}
            highlightColor={palette?.primary || '#10B981'}
            badgeText="TIMELAPSE PERTUMBUHAN"
            badgeTextColor={palette?.secondary || '#34D399'}
            fontSize={46}
          />

          <div style={{ width: '80%', height: 420, position: 'relative' }}>
            <svg viewBox="0 0 600 700" style={{ width: '100%', height: '100%' }}>
              <ellipse cx="300" cy="640" rx="200" ry="36" fill="#78350F" />
              <GrowAxis axis="y" origin="bottom center" progress={progress} fromProgress={0.05} toProgress={0.65}>
                <path d="M 300 620 Q 295 450 300 300" stroke="#10B981" strokeWidth="12" strokeLinecap="round" fill="none" />
              </GrowAxis>
              <StagedReveal
                count={6}
                from={0.25}
                to={0.8}
                progress={progress}
                containerTag="g"
                renderItem={(i, p) => {
                  const side = i % 2 === 0 ? 1 : -1;
                  const ly = 540 - i * 40;
                  return (
                    <ellipse
                      key={i}
                      cx={300 + side * 40 * p}
                      cy={ly}
                      rx={30 * p}
                      ry={14 * p}
                      fill="#34D399"
                      transform={\`rotate(\${side * 25} \${300 + side * 40 * p} \${ly})\`}
                    />
                  );
                }}
              />
              <StateMorph
                progress={progress}
                states={[
                  { at: 0.6, scale: 0.1, color: '#047857' },
                  { at: 0.85, scale: 0.7, color: '#FBBF24' },
                  { at: 1.0, scale: 1.2, color: '#EF4444' },
                ]}
              >
                {({ color, scale }) => (
                  <g transform={\`translate(300, 280) scale(\${scale})\`}>
                    {[0, 60, 120, 180, 240, 300].map((deg) => (
                      <circle key={deg} cx={Math.cos((deg * Math.PI) / 180) * 22} cy={Math.sin((deg * Math.PI) / 180) * 22} r="16" fill={color} />
                    ))}
                    <circle cx="0" cy="0" r="14" fill="#FEF08A" />
                  </g>
                )}
              </StateMorph>
            </svg>
          </div>

          <TimeHUD
            mode="bar"
            label="Pertumbuhan Tanaman"
            fromLabel="${fromLabel}"
            toLabel="${toLabel}"
            accentColor={palette?.primary || '#10B981'}
            style={{ width: 360 }}
          />
        </div>
      </CameraRig>

      ${scene.voiceoverText ? `<SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#10B981'}
        bottomOffset={180}
      />` : ''}
    </div>
  );
};

export default ${compName};
`;
    }

    if (isDayNight) {
      const fromTime = fromLabel.includes(':') ? fromLabel : '06:00';
      const toTime = toLabel.includes(':') ? toLabel : '20:00';

      return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  DayNightSky,
  TimelapseClock,
  TimelapseProgress,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#090D16',
        color: palette?.text || '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <DayNightSky showSunMoon={true} showStars={true} />
      </div>

      <CameraRig mode="timelapse" fromScale={1.0} toScale={1.04}>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 32,
            paddingBottom: 80,
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Waktu', 'Siklus', 'Hari', 'Malam', 'Siang']}
            highlightColor={palette?.primary || '#F59E0B'}
            badgeText="TIMELAPSE SEQUENCE"
            badgeTextColor={palette?.secondary || '#38BDF8'}
            fontSize={48}
          />

          <TimelapseClock
            fromTime="${fromTime}"
            toTime="${toTime}"
            label="TIMELAPSE"
            speedMultiplier="60x Speed"
            accentColor={palette?.secondary || '#38BDF8'}
            size={180}
          />

          <TimelapseProgress
            fromLabel="${fromTime}"
            toLabel="${toTime}"
            label="Perjalanan Waktu"
            accentColor={palette?.primary || '#F59E0B'}
          />
        </div>
      </CameraRig>

      ${scene.voiceoverText ? `<SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#F59E0B'}
        bottomOffset={180}
      />` : ''}
    </div>
  );
};

export default ${compName};
`;
    }

    // Neutral / General Timelapse Scene (e.g. plants, processes, abstract evolution)
    return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  StagedReveal,
  GrowAxis,
  TimeHUD,
  SyncedCaptions,
  useTimelapseProgress,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  const progress = useTimelapseProgress();
  const stageCount = 8;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#0F172A',
        color: palette?.text || '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CameraRig mode="timelapse" fromScale={1.0} toScale={1.04}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 28,
            paddingBottom: 60,
          }}
        >
          <KineticHeadline
            text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
            highlightWords={['Progres', 'Tahap', 'Transformasi', 'Waktu', 'Evolusi']}
            highlightColor={palette?.primary || '#10B981'}
            badgeText="TIMELAPSE PROGRES"
            badgeTextColor={palette?.secondary || '#38BDF8'}
            fontSize={46}
          />

          <div style={{ width: '80%', height: 380, position: 'relative' }}>
            <svg viewBox="0 0 600 500" style={{ width: '100%', height: '100%' }}>
              <GrowAxis axis="scale" progress={progress} origin="center center">
                <circle cx="300" cy="250" r="140" fill="none" stroke={palette?.secondary || '#38BDF8'} strokeWidth="2" strokeDasharray="6 6" opacity={0.3} />
              </GrowAxis>

              <StagedReveal
                count={stageCount}
                from={0.1}
                to={0.9}
                progress={progress}
                containerTag="g"
                renderItem={(idx, itemProg) => {
                  const angle = (idx / stageCount) * Math.PI * 2 - Math.PI / 2;
                  const cx = 300 + Math.cos(angle) * 140;
                  const cy = 250 + Math.sin(angle) * 140;
                  return (
                    <g key={idx} opacity={itemProg} transform={\`scale(\${itemProg}) translate(\${cx * (1 - itemProg)}, \${cy * (1 - itemProg)})\`}>
                      <circle cx={cx} cy={cy} r="22" fill={palette?.primary || '#10B981'} />
                      <circle cx={cx} cy={cy} r="30" fill="none" stroke={palette?.primary || '#10B981'} strokeWidth="2" opacity={0.4} />
                    </g>
                  );
                }}
              />
            </svg>
          </div>

          <TimeHUD
            mode="bar"
            label="Tahapan Proses"
            fromLabel="${fromLabel}"
            toLabel="${toLabel}"
            accentColor={palette?.primary || '#10B981'}
            style={{ width: 360 }}
          />
        </div>
      </CameraRig>

      ${scene.voiceoverText ? `<SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#10B981'}
        bottomOffset={180}
      />` : ''}
    </div>
  );
};

export default ${compName};
`;
  }

  return `import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  ParallaxWorld,
  SvgParticles,
  SyncedCaptions,
} from '@/motion-kit';

export interface SceneProps {
  palette?: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
  };
}

export const ${compName}: React.FC<SceneProps> = ({ palette }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette?.background || '#1A1412',
        color: palette?.text || '#FEF3C7',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <ParallaxWorld
        skyColors={['#1E1B4B', '#312E81']}
        hillsColors={['#064E3B', '#047857', '#059669']}
      >
        <SvgParticles count={30} color={palette?.primary || '#F59E0B'} />
        <CameraRig mode="${scene.cameraAction}" fromScale={1.0} toScale={1.12}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 140,
              gap: 36,
              height: '100%',
            }}
          >
            <KineticHeadline
              text="${scene.kineticHeadline.replace(/"/g, '\\"')}"
              highlightWords={['Kopi', 'Gunung', 'Pagi', 'Aroma', 'Rasa']}
              highlightColor={palette?.primary || '#F59E0B'}
              badgeText="CHAPTER 0${sceneNum}"
              badgeTextColor={palette?.primary || '#F59E0B'}
              fontSize={48}
            />
          </div>
        </CameraRig>
      </ParallaxWorld>

      <SyncedCaptions
        text="${scene.voiceoverText.replace(/"/g, '\\"')}"
        wordTimings={${JSON.stringify(scene.wordTimings)}}
        activeColor={palette?.primary || '#F59E0B'}
        bottomOffset={180}
      />
    </div>
  );
};

export default ${compName};
`;
}

/**
 * Generate MainVideo composition file combining all scenes and audio
 */
export function generateMainVideoCode(
  storyboard: Storyboard,
  sceneIndexes: number[] = storyboard.scenes.map((_, index) => index)
): string {
  const sceneImports = sceneIndexes
    .map((i) => `import Scene${i + 1} from './Scene${i + 1}';`)
    .join('\n');

  const sequences = sceneIndexes
    .map((i) => {
      const s = storyboard.scenes[i];
      return `      <Series.Sequence durationInFrames={${s.durationInFrames}}>
        <Scene${i + 1} palette={palette} />
        {/* Voiceover audio for Scene ${i + 1} */}
        ${s.audioUrl ? `<Audio src="${s.audioUrl}" volume={1.0} />` : ''}
      </Series.Sequence>`;
    })
    .join('\n');

  return `import React from 'react';
import { Series, Audio } from 'remotion';
${sceneImports}

export const MainVideo: React.FC = () => {
  const palette = ${JSON.stringify(storyboard.palette, null, 2)};

  return (
    <div style={{ flex: 1, backgroundColor: palette.background, width: '100%', height: '100%' }}>
      <Series>
${sequences}
      </Series>
    </div>
  );
};

export default MainVideo;
`;
}

/**
 * Generate the TSX file for one scene
 */
export async function generateSceneFile(storyboard: Storyboard, i: number): Promise<string> {
  const isAds = storyboard.preset === 'ads-ui';
  const { width, height } = AspectRatioDimensions[storyboard.aspectRatio];
  const outline = storyboard.scenes.map((scene, index) => `${index + 1}. ${scene.title}`).join('\n');
  const scene = storyboard.scenes[i];
    const fileName = `Scene${i + 1}.tsx`;

    let code = '';
    if (isApiKeyConfigured()) {
      try {
        const isTimelapseScene = scene.cameraAction === 'timelapse' || Boolean(scene.timelapse);
        let prompt = `Write Remotion scene component '${fileName}' for:
Composition: ${width} x ${height} pixels (${storyboard.aspectRatio}). Use useVideoConfig() for responsive positions and sizes; do not assume a 1080x1920 canvas.
Video outline, for continuity:
${outline}
This file is scene ${i + 1} of ${storyboard.scenes.length}. Show this stage specifically, using the Visual Prompt and accurate domain detail.
Role: ${scene.role}
CTA rule: ${scene.role === 'cta' ? 'CTA explicitly allowed for this scene.' : 'No CTA buttons, invented URLs, sales offers, or promotional calls to action. This is content, not an ad closing.'}
Title: ${scene.title}
Kinetic Headline: "${scene.kineticHeadline}"
Voiceover Text: "${scene.voiceoverText}"
Visual Prompt: "${scene.visualPrompt}"
Camera Action: "${scene.cameraAction}"
Timelapse: ${JSON.stringify(scene.timelapse || null)}
Locked DurationInFrames: ${scene.durationInFrames}
WordTimings: ${JSON.stringify(scene.wordTimings)}
Color Palette: ${JSON.stringify(storyboard.palette)}

Ensure you import components from '@/motion-kit' and write high-converting clean TSX.`;

        if (isTimelapseScene) {
          prompt += `\n\nTIMELAPSE INSTRUCTIONS:
- You MUST animate the progression using useTimelapseProgress() or frame calculations.
- Use generic composable primitives: <StagedReveal />, <GrowAxis />, <StateMorph />, <Repeat />, <PathMover />, and <TimeHUD mode="bar"|"badge" />.
- Do NOT use DayNightSky or TimelapseClock unless the visualPrompt specifically describes day-to-night / sun-moon sky transitions.
${TIMELAPSE_FEW_SHOT_EXAMPLES}`;
        }

        const response = await generateText({
          model: getCoderModel(),
          system: CODER_SYSTEM_PROMPT,
          prompt,
        });

        const extracted = response.text.match(/```(?:tsx|typescript)?\s*([\s\S]*?)```/);
        code = extracted ? extracted[1].trim() : response.text.trim();

        // Validate
        const val = validateSceneCode(code, fileName);
        if (!val.valid || (scene.role !== 'cta' && /<PulseCTAButton\b/.test(code))) {
          console.warn(`[CoderAgent] Generated code for ${fileName} had errors, attempting 1-step repair:`, val.errors);
          try {
            const errorDetails = [
              ...val.errors,
              ...(scene.role !== 'cta' && /<PulseCTAButton\b/.test(code) ? ['Do not include PulseCTAButton in non-CTA scenes.'] : [])
            ];
            const repairPrompt = `The previous Remotion code for '${fileName}' had the following validation errors:
${errorDetails.map(e => `- ${e}`).join('\n')}

Original Code:
\`\`\`tsx
${code}
\`\`\`

Fix all errors and return ONLY clean, working TypeScript/TSX code inside \`\`\`tsx codeblock. Ensure imports are strictly from 'react', 'remotion', 'lucide-react', or '@/motion-kit'.`;

            const repairResponse = await generateText({
              model: getCoderModel(),
              system: CODER_SYSTEM_PROMPT,
              prompt: repairPrompt,
            });
            const repExtracted = repairResponse.text.match(/```(?:tsx|typescript)?\s*([\s\S]*?)```/);
            const repairedCode = repExtracted ? repExtracted[1].trim() : repairResponse.text.trim();
            const repVal = validateSceneCode(repairedCode, fileName);
            if (repVal.valid && !(scene.role !== 'cta' && /<PulseCTAButton\b/.test(repairedCode))) {
              code = repairedCode;
            } else {
              code = isAds
                ? generateProceduralAdsSceneCode(scene, i)
                : generateProceduralStorySceneCode(scene, i);
            }
          } catch {
            code = isAds
              ? generateProceduralAdsSceneCode(scene, i)
              : generateProceduralStorySceneCode(scene, i);
          }
        }
      } catch (err) {
        console.warn(`[CoderAgent] LLM failed for ${fileName}, using procedural template:`, err);
        code = isAds
          ? generateProceduralAdsSceneCode(scene, i)
          : generateProceduralStorySceneCode(scene, i);
      }
    } else {
      code = isAds
        ? generateProceduralAdsSceneCode(scene, i)
        : generateProceduralStorySceneCode(scene, i);
    }

    if (!code.includes('export default')) {
      const compName = `Scene${i + 1}`;
      if (code.includes(compName)) {
        code += `\nexport default ${compName};\n`;
      }
    }

    return code;
}

/**
 * Generate virtual project files for all scenes and MainVideo
 */
export async function generateProjectVirtualFiles(storyboard: Storyboard): Promise<VirtualFileMap> {
  const files: VirtualFileMap = {};
  const sceneCodes = await mapWithConcurrency(storyboard.scenes, PIPELINE_CONCURRENCY, (_, index) =>
    generateSceneFile(storyboard, index)
  );

  sceneCodes.forEach((code, index) => {
    files[`Scene${index + 1}.tsx`] = code;
  });
  files['MainVideo.tsx'] = generateMainVideoCode(storyboard);

  return files;
}

/**
 * Revise a single scene based on user chat instructions
 */
export async function reviseSceneCode(
  currentCode: string,
  scene: SceneSpec,
  revisionInstruction: string,
  palette: Storyboard['palette']
): Promise<string> {
  if (isApiKeyConfigured()) {
    try {
      const prompt = `Here is the current code for scene '${scene.id}':
\`\`\`tsx
${currentCode}
\`\`\`

User revision instruction: "${revisionInstruction}"
Scene Spec:
Kinetic Headline: "${scene.kineticHeadline}"
DurationInFrames: ${scene.durationInFrames}
Color Palette: ${JSON.stringify(palette)}

Modify the code according to user request. Maintain all '@/motion-kit' imports and Remotion rules. Return full updated TSX code inside \`\`\`tsx codeblock.`;

      const response = await generateText({
        model: getCoderModel(),
        system: CODER_SYSTEM_PROMPT,
        prompt,
      });

      const extracted = response.text.match(/```(?:tsx|typescript)?\s*([\s\S]*?)```/);
      const newCode = extracted ? extracted[1].trim() : response.text.trim();

      const val = validateSceneCode(newCode, `${scene.id}.tsx`);
      if (val.valid) {
        let finalRev = newCode;
        const match = scene.id.match(/\d+/);
        const compName = `Scene${match ? match[0] : '1'}`;
        if (!finalRev.includes('export default') && finalRev.includes(compName)) {
          finalRev += `\nexport default ${compName};\n`;
        }
        return finalRev;
      }
    } catch (err) {
      console.warn('[CoderAgent] LLM scene revision failed:', err);
    }
  }

  // Direct keyword-based patch fallback if LLM unavailable
  let patched = currentCode;
  if (/emas|gold/i.test(revisionInstruction)) {
    patched = patched.replace(/#38BDF8|#10B981/g, '#F59E0B');
  }
  if (/120\.000\.000|120 juta/i.test(revisionInstruction)) {
    patched = patched.replace(/Rp\s*[\d.]+/g, 'Rp 120.000.000');
  }
  return patched;
}
