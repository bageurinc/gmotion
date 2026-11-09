import React, { useId } from 'react';

export interface IsoAlternatorProps extends React.SVGProps<SVGSVGElement> {
  /** 0 = fully assembled, 1 = fully exploded along the isometric assembly axis. */
  explode?: number;
  /** Whether to render numbered engineering callout bubbles (matching FIG.49). */
  showCallouts?: boolean;
  /** Overall scale opacity. */
  opacity?: number;
  /** Accessible title. */
  title?: string;
}

const COS_30 = Math.sqrt(3) / 2; // ~0.866
const SIN_30 = 0.5;

// Isometric projection vector along the assembly centerline axis (-X, -Y, +Z or diagonal)
// We project components along a 30-degree isometric disassembly axis: dx = -1.2 * COS_30, dy = -1.2 * SIN_30
function axisPos(distance: number, explodeRatio: number) {
  const t = distance * explodeRatio;
  return {
    x: 380 - t * COS_30 * 1.15,
    y: 240 + t * SIN_30 * 0.95,
  };
}

/**
 * IsoAlternator: Exploded isometric spare parts diagram of an automotive alternator/generator,
 * modeled directly from official service manual schematics (FIG.49 Generator).
 * 
 * Supports smooth animation via the `explode` prop (0 = assembled, 1 = exploded).
 */
export const IsoAlternator: React.FC<IsoAlternatorProps> = ({
  explode = 0.85,
  showCallouts = true,
  opacity = 1,
  title = 'Diagram Terurai Alternator Mobil (FIG.49)',
  style,
  ...svgProps
}) => {
  const id = `alt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const k = Number.isFinite(explode) ? Math.max(0, Math.min(1.2, explode)) : 0.85;

  // Assembly distances along center axis (from front pulley to rear cover)
  // Distance negative = forward-left, positive = backward-right
  const posNut = axisPos(-160, k);
  const posPulley = axisPos(-120, k);
  const posFrontHousing = axisPos(-60, k);
  const posFrontBearing = axisPos(-10, k);
  const posStator = axisPos(35, k);
  const posRotor = axisPos(80, k);
  const posRearBearing = axisPos(130, k);
  const posRearHousing = axisPos(175, k);
  const posRectifier = axisPos(225, k);
  const posRegulator = axisPos(265, k);
  const posBrush = axisPos(305, k);
  const posRearCover = axisPos(350, k);

  const CalloutBadge: React.FC<{ x: number; y: number; num: string | number; lineTo?: { x: number; y: number } }> = ({
    x, y, num, lineTo,
  }) => (
    <g data-part={`callout-${num}`} opacity={showCallouts ? 1 : 0}>
      {lineTo && (
        <line
          x1={lineTo.x}
          y1={lineTo.y}
          x2={x}
          y2={y}
          stroke="#52646B"
          strokeWidth={0.9}
          strokeDasharray="2 2"
        />
      )}
      <circle cx={x} cy={y} r={9} fill="#FFFFFF" stroke="#263238" strokeWidth={1.2} />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight="bold"
        fontFamily="sans-serif"
        fill="#1E282D"
      >
        {num}
      </text>
    </g>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 480"
      role="img"
      aria-labelledby={`${id}-title`}
      {...svgProps}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      opacity={opacity}
    >
      <title id={`${id}-title`}>{title}</title>

      <defs>
        {/* Soft shadow and gradients for metal parts */}
        <linearGradient id={`${id}-metal-light`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E2EBEF" />
          <stop offset="50%" stopColor="#BAC9CE" />
          <stop offset="100%" stopColor="#8A9CA2" />
        </linearGradient>
        <linearGradient id={`${id}-copper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={`${id}-steel-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Assembly Centerline Dash Guide */}
      {k > 0.1 && (
        <line
          x1={axisPos(-190, k).x}
          y1={axisPos(-190, k).y}
          x2={axisPos(380, k).x}
          y2={axisPos(380, k).y}
          stroke="#94A3B8"
          strokeWidth={1.2}
          strokeDasharray="6 4 2 4"
        />
      )}

      {/* ========================================================================= */}
      {/* 1. PULLEY LOCK NUT (#26) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posNut.x} ${posNut.y})`} data-part="lock-nut">
        {/* Hex Flange Nut */}
        <ellipse cx={0} cy={0} rx={12} ry={7} fill="#CBD5E1" stroke="#334155" strokeWidth={1.2} />
        <polygon points="-7,-4 0,-7 7,-4 7,4 0,7 -7,4" fill="#94A3B8" stroke="#334155" strokeWidth={1} />
        <circle cx={0} cy={0} r={3} fill="#475569" />
        <CalloutBadge x={-26} y={-24} num="26" lineTo={{ x: 0, y: 0 }} />
      </g>

      {/* ========================================================================= */}
      {/* 2. SERPENTINE DRIVE PULLEY (#2) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posPulley.x} ${posPulley.y})`} data-part="pulley">
        {/* Outer flange */}
        <ellipse cx={0} cy={0} rx={28} ry={16} fill="url(#metal-light)" stroke="#1E293B" strokeWidth={1.4} />
        {/* Multi-rib serpentine V-grooves */}
        {[-3, 0, 3].map((dy, i) => (
          <ellipse key={i} cx={0} cy={dy} rx={25 - Math.abs(dy)} ry={14 - Math.abs(dy) * 0.5} fill="none" stroke="#475569" strokeWidth={1.4} />
        ))}
        {/* Recessed hub face & center shaft bore */}
        <ellipse cx={0} cy={0} rx={14} ry={8} fill="#64748B" stroke="#1E293B" strokeWidth={1} />
        <ellipse cx={0} cy={0} rx={7} ry={4} fill="#0F172A" />
        <CalloutBadge x={-22} y={-38} num="2" lineTo={{ x: 0, y: -10 }} />
      </g>

      {/* ========================================================================= */}
      {/* 3. FRONT DRIVE END HOUSING / BRACKET (#1) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posFrontHousing.x} ${posFrontHousing.y})`} data-part="front-housing">
        {/* Mounting Lug Ears */}
        <path d="M -38 -28 L -24 -42 L -12 -38 L -26 -20 Z" fill="#94A3B8" stroke="#1E293B" strokeWidth={1.2} />
        <circle cx={-24} cy={-34} r={3.5} fill="#475569" stroke="#1E293B" strokeWidth={0.8} />
        {/* Main circular aluminum casing */}
        <ellipse cx={0} cy={0} rx={48} ry={28} fill="url(#metal-light)" stroke="#1E293B" strokeWidth={1.5} />
        {/* Radial cooling ventilation slots */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4;
          const rx1 = Math.cos(angle) * 22;
          const ry1 = Math.sin(angle) * 12;
          const rx2 = Math.cos(angle) * 38;
          const ry2 = Math.sin(angle) * 21;
          return <line key={i} x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#1E293B" strokeWidth={3} strokeLinecap="round" />;
        })}
        {/* Center bearing pocket cavity */}
        <ellipse cx={0} cy={0} rx={18} ry={10} fill="#64748B" stroke="#1E293B" strokeWidth={1.2} />
        <CalloutBadge x={-52} y={-46} num="1" lineTo={{ x: -20, y: -15 }} />
      </g>

      {/* ========================================================================= */}
      {/* 4. FRONT BALL BEARING & RETAINER PLATE (#4, #5, #6) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posFrontBearing.x} ${posFrontBearing.y})`} data-part="front-bearing">
        {/* Bearing Retainer Plate (#5) */}
        <path d="M -16 -10 L 16 -10 L 14 10 L -14 10 Z" fill="#64748B" stroke="#1E293B" strokeWidth={1} />
        {/* Retainer screws (#6) */}
        <circle cx={-12} cy={-6} r={1.8} fill="#CBD5E1" stroke="#0F172A" strokeWidth={0.6} />
        <circle cx={12} cy={6} r={1.8} fill="#CBD5E1" stroke="#0F172A" strokeWidth={0.6} />
        {/* Deep Groove Ball Bearing (#4) */}
        <ellipse cx={0} cy={0} rx={15} ry={8.5} fill="#94A3B8" stroke="#1E293B" strokeWidth={1.2} />
        <ellipse cx={0} cy={0} rx={12} ry={6.8} fill="#334155" />
        {/* Bearing steel balls */}
        {[-8, -4, 0, 4, 8].map((bx, i) => (
          <circle key={i} cx={bx} cy={0} r={1.6} fill="#E2E8F0" stroke="#0F172A" strokeWidth={0.5} />
        ))}
        <ellipse cx={0} cy={0} rx={7} ry={4} fill="#64748B" stroke="#1E293B" strokeWidth={0.8} />
        <ellipse cx={0} cy={0} rx={4.5} ry={2.5} fill="#0F172A" />
        <CalloutBadge x={-28} y={-26} num="4" lineTo={{ x: -6, y: -4 }} />
        <CalloutBadge x={26} y={-24} num="5" lineTo={{ x: 8, y: -6 }} />
      </g>

      {/* ========================================================================= */}
      {/* 5. STATOR CORE & COPPER COIL WINDINGS */}
      {/* ========================================================================= */}
      <g transform={`translate(${posStator.x} ${posStator.y})`} data-part="stator">
        {/* Laminated Steel Stator Core Ring */}
        <ellipse cx={0} cy={0} rx={50} ry={29} fill="#475569" stroke="#1E293B" strokeWidth={1.5} />
        {/* Internal stator bore hole */}
        <ellipse cx={0} cy={0} rx={32} ry={18} fill="#1E293B" stroke="#0F172A" strokeWidth={1.2} />
        {/* 3-Phase Copper Coil Windings protruding around perimeter */}
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI) / 8;
          const cx1 = Math.cos(a) * 44;
          const cy1 = Math.sin(a) * 24;
          return (
            <ellipse
              key={i}
              cx={cx1}
              cy={cy1}
              rx={6}
              ry={4}
              fill="url(#copper)"
              stroke="#78350F"
              strokeWidth={0.8}
            />
          );
        })}
        {/* Stator lead terminal wire terminals */}
        <path d="M -12 -25 Q -10 -35 -4 -38" fill="none" stroke="#D97706" strokeWidth={1.8} />
        <path d="M 0 -27 Q 4 -37 10 -38" fill="none" stroke="#D97706" strokeWidth={1.8} />
        <circle cx={-4} cy={-38} r={2} fill="#FCD34D" stroke="#78350F" strokeWidth={0.6} />
        <circle cx={10} cy={-38} r={2} fill="#FCD34D" stroke="#78350F" strokeWidth={0.6} />
      </g>

      {/* ========================================================================= */}
      {/* 6. ROTOR ASSEMBLY: CLAW POLES, SHAFT, FIELD COIL (#19) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRotor.x} ${posRotor.y})`} data-part="rotor">
        {/* Hardened Steel Center Rotor Shaft */}
        <line x1={-35} y1={-18} x2={45} y2={24} stroke="#CBD5E1" strokeWidth={5} strokeLinecap="round" />
        <line x1={-35} y1={-18} x2={45} y2={24} stroke="#1E293B" strokeWidth={1.5} />
        {/* Front Interlocking Claw-Pole Magnetic Core */}
        <path
          d="M -22 -12 L -6 -24 L 14 -18 L 8 4 L -12 8 Z"
          fill="url(#steel-dark)"
          stroke="#0F172A"
          strokeWidth={1.2}
        />
        {/* Interleaved triangular claw fingers */}
        {[-14, -6, 2, 10].map((cx, i) => (
          <polygon
            key={i}
            points={`${cx},-10 ${cx + 7},-6 ${cx + 4},12 ${cx - 3},8`}
            fill="#64748B"
            stroke="#1E293B"
            strokeWidth={0.8}
          />
        ))}
        {/* Copper Field Coil visible inside claw fingers */}
        <rect x={-8} y={-4} width={16} height={12} rx={2} fill="url(#copper)" stroke="#78350F" strokeWidth={0.8} />
        {/* Internal Cooling Fan Blades attached to rotor face */}
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 12}
              y1={Math.sin(a) * 7}
              x2={Math.cos(a) * 26}
              y2={Math.sin(a) * 15}
              stroke="#94A3B8"
              strokeWidth={2}
            />
          );
        })}
        {/* Rear Copper Slip Rings at end of shaft */}
        <ellipse cx={28} cy={15} rx={5} ry={3} fill="#D97706" stroke="#78350F" strokeWidth={0.8} />
        <ellipse cx={33} cy={18} rx={5} ry={3} fill="#D97706" stroke="#78350F" strokeWidth={0.8} />
        <CalloutBadge x={-35} y={-38} num="19" lineTo={{ x: -10, y: -10 }} />
      </g>

      {/* ========================================================================= */}
      {/* 7. REAR BEARING & WASHERS (#20, #21, #16) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRearBearing.x} ${posRearBearing.y})`} data-part="rear-bearing">
        {/* Wave washer (#16) */}
        <ellipse cx={-8} cy={-4} rx={11} ry={6} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="3 2" />
        {/* Rear Ball Bearing (#20) */}
        <ellipse cx={0} cy={0} rx={13} ry={7.5} fill="#94A3B8" stroke="#1E293B" strokeWidth={1.2} />
        <ellipse cx={0} cy={0} rx={10} ry={5.8} fill="#334155" />
        <ellipse cx={0} cy={0} rx={5} ry={3} fill="#0F172A" />
        <CalloutBadge x={18} y={-22} num="20" lineTo={{ x: 4, y: -2 }} />
      </g>

      {/* ========================================================================= */}
      {/* 8. REAR END FRAME HOUSING (#13) & THROUGH-BOLTS (#7) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRearHousing.x} ${posRearHousing.y})`} data-part="rear-housing">
        {/* Mounting pivot bracket ear */}
        <path d="M 32 18 L 48 26 L 40 36 L 24 28 Z" fill="#94A3B8" stroke="#1E293B" strokeWidth={1.2} />
        <circle cx={38} cy={27} r={4} fill="#475569" stroke="#1E293B" strokeWidth={0.8} />
        {/* Aluminum housing shell */}
        <ellipse cx={0} cy={0} rx={48} ry={28} fill="url(#metal-light)" stroke="#1E293B" strokeWidth={1.5} />
        {/* Air ventilation cooling slots */}
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return (
            <ellipse
              key={i}
              cx={Math.cos(a) * 28}
              cy={Math.sin(a) * 16}
              rx={6}
              ry={3.5}
              fill="#1E293B"
            />
          );
        })}
        {/* Center bearing pocket & mounting stud bolts (#7) */}
        <ellipse cx={0} cy={0} rx={16} ry={9} fill="#475569" stroke="#1E293B" strokeWidth={1} />
        {[-26, 26].map((sx, i) => (
          <circle key={i} cx={sx} cy={0} r={2.4} fill="#CBD5E1" stroke="#0F172A" strokeWidth={0.8} />
        ))}
        <CalloutBadge x={-48} y={-42} num="13" lineTo={{ x: -20, y: -15 }} />
      </g>

      {/* ========================================================================= */}
      {/* 9. RECTIFIER / DIODE BRIDGE ASSEMBLY (#15) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRectifier.x} ${posRectifier.y})`} data-part="rectifier">
        {/* Crescent-shaped aluminum heat sink plate */}
        <path
          d="M -30 -14 C -15 -28 15 -28 32 -10 L 26 4 C 12 -12 -10 -12 -24 0 Z"
          fill="#CBD5E1"
          stroke="#1E293B"
          strokeWidth={1.2}
        />
        {/* Cooling heat sink fins */}
        {[-18, -10, -2, 6, 14, 22].map((fx, i) => (
          <line key={i} x1={fx} y1={-18} x2={fx + 3} y2={-8} stroke="#475569" strokeWidth={1.2} />
        ))}
        {/* Silicon power press-fit diodes (6 units) */}
        {[-16, -6, 4, 16].map((dx, i) => (
          <circle key={i} cx={dx} cy={-10} r={2.5} fill="#1E293B" stroke="#94A3B8" strokeWidth={0.8} />
        ))}
        {/* B+ Output Battery Stud Bolt */}
        <rect x={18} y={-24} width={5} height={10} fill="#D97706" stroke="#78350F" strokeWidth={0.8} />
        <CalloutBadge x={-42} y={-32} num="15" lineTo={{ x: -16, y: -16 }} />
      </g>

      {/* ========================================================================= */}
      {/* 10. IC VOLTAGE REGULATOR MODULE (#22) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRegulator.x} ${posRegulator.y})`} data-part="regulator">
        {/* Black epoxy / molded plastic IC housing */}
        <polygon points="-16,-12 10,-12 16,8 -10,8" fill="#1E293B" stroke="#0F172A" strokeWidth={1.2} />
        {/* Integrated circuit heat sink tab */}
        <rect x={-14} y={-10} width={22} height={4} fill="#94A3B8" />
        {/* Electrical terminal harness plug socket */}
        <rect x={-8} y={4} width={14} height={8} fill="#334155" stroke="#0F172A" strokeWidth={0.8} />
        <line x1={-4} y1={7} x2={-4} y2={11} stroke="#FCD34D" strokeWidth={1} />
        <line x1={0} y1={7} x2={0} y2={11} stroke="#FCD34D" strokeWidth={1} />
        <line x1={4} y1={7} x2={4} y2={11} stroke="#FCD34D" strokeWidth={1} />
        <CalloutBadge x={28} y={-24} num="22" lineTo={{ x: 6, y: -6 }} />
      </g>

      {/* ========================================================================= */}
      {/* 11. BRUSH HOLDER & CARBON BRUSHES (#17, #18, #25) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posBrush.x} ${posBrush.y})`} data-part="brush-holder">
        {/* Molded plastic brush box guide */}
        <rect x={-12} y={-8} width={20} height={16} rx={2} fill="#0F172A" stroke="#475569" strokeWidth={1} />
        {/* Carbon brushes with coil springs (#18) */}
        <rect x={-8} y={-5} width={12} height={4} fill="#334155" stroke="#94A3B8" strokeWidth={0.6} />
        <rect x={-8} y={3} width={12} height={4} fill="#334155" stroke="#94A3B8" strokeWidth={0.6} />
        {/* Copper braided pigtail lead wires */}
        <path d="M 4 -3 Q 10 -3 14 0" fill="none" stroke="#D97706" strokeWidth={1} />
        <path d="M 4 5 Q 10 5 14 2" fill="none" stroke="#D97706" strokeWidth={1} />
        {/* Protective rubber brush cover cap (#25) */}
        <path d="M -16 -10 L -4 -10 L -2 12 L -14 12 Z" fill="#475569" opacity={0.8} />
        <CalloutBadge x={26} y={-16} num="17" lineTo={{ x: 8, y: -2 }} />
      </g>

      {/* ========================================================================= */}
      {/* 12. REAR VENTILATED COVER (#14) & B+ TERMINAL INSULATOR (#23) */}
      {/* ========================================================================= */}
      <g transform={`translate(${posRearCover.x} ${posRearCover.y})`} data-part="rear-cover">
        {/* Main stamped steel / plastic rear end cover */}
        <ellipse cx={0} cy={0} rx={46} ry={27} fill="#1E293B" stroke="#0F172A" strokeWidth={1.5} />
        {/* Louver air vents stamped into cover */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI) / 5;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 20}
              y1={Math.sin(a) * 11}
              x2={Math.cos(a) * 34}
              y2={Math.sin(a) * 20}
              stroke="#475569"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        {/* Rubber terminal boot / insulator (#23) */}
        <rect x={18} y={-18} width={10} height={12} rx={2} fill="#B91C1C" stroke="#7F1D1D" strokeWidth={0.8} />
        <circle cx={23} cy={-12} r={2} fill="#FCD34D" />
        {/* Grounding terminal bracket (#12) & fastening screws (#9) */}
        <path d="M -18 12 L -8 18 L -14 24 Z" fill="#94A3B8" stroke="#1E293B" strokeWidth={0.8} />
        <circle cx={-12} cy={17} r={2} fill="#CBD5E1" stroke="#0F172A" strokeWidth={0.6} />
        <CalloutBadge x={38} y={-32} num="14" lineTo={{ x: 15, y: -10 }} />
      </g>

      {/* Diagram Title Banner in Engineering CAD Style */}
      <g data-part="diagram-title" transform="translate(30, 42)">
        <text fontSize={18} fontWeight="bold" fontFamily="monospace, sans-serif" fill="#1E293B">
          FIG.49 GENERATOR / ALTERNATOR
        </text>
        <text y={16} fontSize={10} fontFamily="sans-serif" fill="#64748B">
          DIAGRAM TERURAI SPARE PART ISOMETRIK (EXPLODED VIEW)
        </text>
      </g>
    </svg>
  );
};
