/**
 * Concise TypeScript definitions & examples injected into the AI Coder prompt
 * so the model writes valid, idiomatic TSX matching our exact design system.
 */
export const MOTION_KIT_PROMPT_DOCS = `
### Available Curated Motion Components in '@motion-kit'

You MUST compose scenes using these prebuilt components alongside custom clean SVG illustrations.

1. <CameraRig mode="macro-zoom-in" | "slow-push" | "pan-parallax" | "tilt-3d" | "static" fromScale={1.0} toScale={1.15} targetX={0} targetY={0} microDrift={true}>
   {children}
</CameraRig>
- Wraps entire scene for cinematic camera work. Always use as the root wrapper inside a Scene.
- CameraRig moves the artwork only. KineticHeadline, SyncedCaptions, and PulseCTAButton are automatically placed in a separate social safe overlay, outside zoom and clipping.

2. <KineticHeadline text="Stop Ghosting Chat!" highlightWords={["Ghosting"]} highlightColor="#EF4444" badgeText="Masalah Utama" align="center" fontSize={54} />
   - Use at top of scene for bold hook / headline.
   - Automatically wraps within the safe area. Do not apply nowrap, fixed text widths, or camera transforms to copy.

3. <PhoneMockup width={400} height={780} glowColor="#10B981" floatingBadge={{ text: "Order Closed!", subtext: "Rp 350.000 via WhatsApp", icon: "dollar" }}>
   <WhatsAppChatSim contactName="Calon Buyer" messages={[...]} />
</PhoneMockup>

4. <WhatsAppChatSim contactName="Siti Rahma" contactStatus="Online" messages={[
     { id: "1", sender: "customer", text: "Halo kak, masih ada promo?", time: "09:41", delayFrames: 0 },
     { id: "2", sender: "ai", text: "Hai kak! Masih, khusus hari ini diskon 50% ya 🚀", time: "09:41", delayFrames: 15, status: "read" }
   ]} showTypingAfterFrame={8} showGhostingAlert={false} />

5. <MetricsDashboard>:
   - <MetricCard label="Closing Rate Sales" value={420} suffix="%" changePercent={320} color="#10B981" />
   - <AnimatedCounter from={0} to={125000000} formatter={(val) => 'Rp ' + val.toLocaleString('id-ID')} />
   - <TrendLineChart data={[20, 35, 45, 60, 95, 140, 210]} peakLabel="Rp 120 Juta" lineColor="#38BDF8" width={560} height={260} />

6. <PulseCTAButton buttonText="Coba Gratis Sekarang" subtext="Klik Link di Bio / DM Kami" bgColor="#22C55E" glowColor="#22C55E" />

7. <ParallaxWorld skyColors={["#0F172A", "#1E293B"]} hillsColors={["#1E3A8A", "#1E40AF", "#1D4ED8"]}>
   <SvgParticles count={25} color="#FEF08A" />
   {/* Custom foreground SVG */}
</ParallaxWorld>

8. <SyncedCaptions text={voiceoverText} wordTimings={wordTimings} activeColor="#FBBF24" bottomOffset={260} />
   - Renders synced subtitles in safe zone. Always place at the end of the Scene.

RULES FOR SCENE CODE GENERATION:
- Separate background from meaningful artwork: <SceneLayout><SceneBackground>{full-frame sky, gradients, scenery, particles}</SceneBackground><KineticHeadline .../><SceneStage>{main subject}</SceneStage><SyncedCaptions .../></SceneLayout>.
- SceneBackground MUST be a direct child of SceneLayout, never inside SceneStage or CameraRig. Use width/height 100% and SVG preserveAspectRatio="xMidYMid slice" ONLY for decorative backgrounds so they cover the full canvas. Use unique SVG definition IDs for each layer. Never put the entire scene background inside the safe area or replace its outer areas with solid padding.
- Foreground SVGs must use preserveAspectRatio="xMidYMid meet", never "slice". Platform safe areas resize the stage; meaningful artwork must stay contained as its aspect ratio changes.
- Use <SceneLayout> as the scene root. Place the headline and captions directly inside it, and wrap the main illustration in <SceneStage>. Its grid reserves separate rows for the headline, artwork, optional CTA, and captions. Do not position foreground content using full-frame space-between layouts.
- Put CameraRig INSIDE SceneStage around the artwork only. Draw SVG art with a tight viewBox and width/height 100% so it fills the stage; background layers may fill the entire frame. Keep pan offsets below 3% of stage dimensions and scale at or below 1.05.
- Only render PulseCTAButton in a scene with role 'cta' when explicitly allowed. Never invent a link, trial, offer, or sales CTA in storytelling or educational content.
- Do NOT use Math.random() or Date.now(). Use Remotion's random(seed) if needed.
- Do NOT use CSS transitions or keyframes. Animate via useCurrentFrame() with interpolate() or spring().
- Keep all props deterministically controlled by frame.
- Wrap SVG elements in standard React tags.
- Backgrounds should fill the composition. Keep meaningful foreground illustrations inside the central safe region; allow only decorative elements to extend past the frame.
- Use standard CSS paddingLeft/paddingRight (not paddingHorizontal). Use boxSizing: 'border-box' and minWidth: 0 on constrained flex items.
`;
