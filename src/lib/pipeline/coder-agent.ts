import { generateText } from 'ai';
import { getCoderModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { Storyboard, SceneSpec, VirtualFileMap, AspectRatioDimensions } from '@/types/studio';
import { MOTION_KIT_PROMPT_DOCS } from '@/motion-kit/docs';
import { validateSceneCode } from './code-validator';

const CODER_SYSTEM_PROMPT = `
You are an expert Remotion & React developer specializing in high-converting motion graphics and SVG animations.

Your task is to write a single self-contained React component for a Remotion scene.

${MOTION_KIT_PROMPT_DOCS}

CRITICAL RULES:
1. ONLY import from:
   - 'react' (React, useMemo, etc.)
   - 'remotion' (useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random, Sequence)
   - '@/motion-kit' (SceneLayout, SceneBackground, SceneStage, CameraRig, KineticHeadline, SyncedCaptions, PhoneMockup, WhatsAppChatSim, MetricCard, AnimatedCounter, TrendLineChart, PulseCTAButton, ParallaxWorld, SvgParticles)
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
export function generateMainVideoCode(storyboard: Storyboard): string {
  const sceneImports = storyboard.scenes
    .map((s, i) => `import Scene${i + 1} from './Scene${i + 1}';`)
    .join('\n');

  const sequences = storyboard.scenes
    .map((s, i) => {
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
 * Generate virtual project files for all scenes and MainVideo
 */
export async function generateProjectVirtualFiles(storyboard: Storyboard): Promise<VirtualFileMap> {
  const files: VirtualFileMap = {};
  const isAds = storyboard.preset === 'ads-ui';
  const { width, height } = AspectRatioDimensions[storyboard.aspectRatio];

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const fileName = `Scene${i + 1}.tsx`;

    let code = '';
    if (isApiKeyConfigured()) {
      try {
        const prompt = `Write Remotion scene component '${fileName}' for:
Composition: ${width} x ${height} pixels (${storyboard.aspectRatio}). Use useVideoConfig() for responsive positions and sizes; do not assume a 1080x1920 canvas.
Role: ${scene.role}
CTA rule: ${scene.role === 'cta' ? 'CTA explicitly allowed for this scene.' : 'No CTA buttons, invented URLs, sales offers, or promotional calls to action. This is content, not an ad closing.'}
Title: ${scene.title}
Kinetic Headline: "${scene.kineticHeadline}"
Voiceover Text: "${scene.voiceoverText}"
Visual Prompt: "${scene.visualPrompt}"
Camera Action: "${scene.cameraAction}"
Locked DurationInFrames: ${scene.durationInFrames}
WordTimings: ${JSON.stringify(scene.wordTimings)}
Color Palette: ${JSON.stringify(storyboard.palette)}

Ensure you import components from '@/motion-kit' and write high-converting clean TSX.`;

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
          console.warn(`[CoderAgent] Generated code for ${fileName} had errors, falling back to procedural template:`, val.errors);
          code = isAds
            ? generateProceduralAdsSceneCode(scene, i)
            : generateProceduralStorySceneCode(scene, i);
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

    files[fileName] = code;
  }

  // Generate MainVideo.tsx
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
