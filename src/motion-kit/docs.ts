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

2. <KineticHeadline text="Stop Ghosting Chat!" highlightWords={["Ghosting"]} highlightColor="#EF4444" badgeText="Masalah Utama" align="center" fontSize={54} />
   - Use at top of scene for bold hook / headline.

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
- Do NOT use Math.random() or Date.now(). Use Remotion's random(seed) if needed.
- Do NOT use CSS transitions or keyframes. Animate via useCurrentFrame() with interpolate() or spring().
- Keep all props deterministically controlled by frame.
- Wrap SVG elements in standard React tags.
`;
