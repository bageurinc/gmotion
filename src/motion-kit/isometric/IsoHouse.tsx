import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

const clamp = (n: number, max = 1) => (Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
const ink = '#35494B';
const points = (p: readonly CarPoint[]) => carPoints(p);

function Block({
  x, y, z = 0, w, d, h, color, shaded = true, strokeWidth = 1.3,
}: {
  x: number; y: number; z?: number; w: number; d: number; h: number; color: string; shaded?: boolean; strokeWidth?: number;
}) {
  const a: CarPoint = [x, y, z];
  const b: CarPoint = [x + w, y, z];
  const c: CarPoint = [x + w, y + d, z];
  const e: CarPoint = [x, y + d, z];
  const top = ([px, py, pz]: CarPoint): CarPoint => [px, py, pz + h];

  return (
    <g stroke={ink} strokeWidth={strokeWidth} strokeLinejoin="round">
      {/* Right face */}
      <polygon points={points([b, c, top(c), top(b)])} fill={color} />
      {shaded ? <polygon points={points([b, c, top(c), top(b)])} fill="#000" opacity={0.18} /> : null}
      {/* Front face */}
      <polygon points={points([e, c, top(c), top(e)])} fill={color} />
      {/* Top face */}
      <polygon points={points([top(a), top(b), top(c), top(e)])} fill={color} />
    </g>
  );
}

function Translate({
  x = 0, y = 0, z = 0, scale = 1, children,
}: {
  x?: number; y?: number; z?: number; scale?: number; children: React.ReactNode;
}) {
  const p = projectCarPoint([x, y, z]);
  return <g transform={`translate(${p.x} ${p.y}) scale(${scale}) translate(-380 -300)`}>{children}</g>;
}

function ParkedCar({ x, y, z = 4, color = '#243342' }: { x: number; y: number; z?: number; color?: string }) {
  return (
    <g data-part="carport-car">
      {/* 4 Roda hitam dengan velg alloy */}
      <Block x={x - 2} y={y + 10} z={z} w={4} d={16} h={16} color="#182022" />
      <Block x={x - 2} y={y + 50} z={z} w={4} d={16} h={16} color="#182022" />
      <Block x={x + 44} y={y + 10} z={z} w={4} d={16} h={16} color="#182022" />
      <Block x={x + 44} y={y + 50} z={z} w={4} d={16} h={16} color="#182022" />
      <Block x={x - 3} y={y + 14} z={z + 4} w={2} d={8} h={8} color="#C4D0D2" />
      <Block x={x - 3} y={y + 54} z={z + 4} w={2} d={8} h={8} color="#C4D0D2" />

      {/* Bodi mobil ramping */}
      <Block x={x} y={y} z={z + 5} w={44} d={76} h={14} color={color} />

      {/* Kabin kaca tinted gelap */}
      <Block x={x + 5} y={y + 12} z={z + 18} w={34} d={45} h={13} color="#142124" />
      <polygon
        points={points([[x + 7, y + 55, z + 19], [x + 37, y + 55, z + 19], [x + 34, y + 45, z + 30], [x + 10, y + 45, z + 30]])}
        fill="#82B2BA"
        opacity={0.7}
      />
      <Block x={x + 6} y={y + 14} z={z + 30} w={32} d={34} h={2} color={color} />

      {/* Kap mesin depan */}
      <polygon
        points={points([
          [x + 2, y + 57, z + 19],
          [x + 42, y + 57, z + 19],
          [x + 40, y + 75, z + 12],
          [x + 4, y + 75, z + 12],
        ])}
        fill={color}
        stroke={ink}
        strokeWidth={1}
      />

      {/* Lampu depan LED */}
      <polygon
        points={points([[x + 6, y + 75.5, z + 10], [x + 16, y + 75.5, z + 10], [x + 15, y + 75.5, z + 15], [x + 7, y + 75.5, z + 15]])}
        fill="#E4F7FA"
        stroke="#4FAAB8"
        strokeWidth={1}
      />
      <polygon
        points={points([[x + 28, y + 75.5, z + 10], [x + 38, y + 75.5, z + 10], [x + 37, y + 75.5, z + 15], [x + 29, y + 75.5, z + 15]])}
        fill="#E4F7FA"
        stroke="#4FAAB8"
        strokeWidth={1}
      />

      {/* Spion samping */}
      <Block x={x - 3} y={y + 48} z={z + 19} w={4} d={5} h={4} color={color} />
      <Block x={x + 43} y={y + 48} z={z + 19} w={4} d={5} h={4} color={color} />
    </g>
  );
}

function Shrub({ x, y, z = 4, r = 10, flowerColor }: { x: number; y: number; z?: number; r?: number; flowerColor?: string }) {
  const p = projectCarPoint([x, y, z + r * 1.6]);
  return (
    <g data-part="garden-shrubs">
      <Block x={x - r} y={y - r} z={z} w={r * 2} d={r * 2} h={r * 1.3} color="#3E7D3F" />
      <Block x={x - r * 0.7} y={y - r * 0.7} z={z + r * 0.7} w={r * 1.4} d={r * 1.4} h={r * 0.9} color="#569E52" />
      {flowerColor ? (
        <circle cx={p.x} cy={p.y} r={2.5} fill={flowerColor} stroke={ink} strokeWidth={0.5} />
      ) : null}
    </g>
  );
}

type CanvasProps = React.SVGProps<SVGSVGElement>;
function Canvas({ children, style, ...props }: CanvasProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 480"
      role="img"
      {...props}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
    >
      {children}
    </svg>
  );
}

const houseAnchor = ([x, y, z]: CarPoint): CarPoint => [x * 0.65, y * 0.65, z * 0.65];

export const ISO_HOUSE_ANCHORS = {
  entrance: houseAnchor([60, 185, 4]),
  door: houseAnchor([60, 146, 95]),
  window: houseAnchor([-100, 146, 110]),
  roof: houseAnchor([0, 0, 310]),
  chimney: houseAnchor([-112, -42, 335]),
  interior: houseAnchor([-60, 30, 40]),
  livingRoom: houseAnchor([-90, 40, 35]),
  kitchen: houseAnchor([-75, -115, 60]),
  kitchenSink: houseAnchor([-60, -115, 95]),
  kitchenFaucet: houseAnchor([-60, -115, 122]),
  bathroom: houseAnchor([110, -60, 60]),
  bathroomSink: houseAnchor([88, -115, 85]),
  bathroomFaucet: houseAnchor([88, -115, 102]),
  shower: houseAnchor([150, -100, 150]),
  waterInlet: houseAnchor([0, -150, 20]),
  drain: houseAnchor([-60, -150, 15]),
  // Luxury variant specific anchors
  pool: houseAnchor([110, 105, 9]),
  balcony: houseAnchor([-45, 38, 160]),
  upperFloor: houseAnchor([-45, -40, 160]),
  kitchenIsland: houseAnchor([-115, -76, 82]),
  luxuryBath: houseAnchor([145, -90, 50]),
  garage: houseAnchor([-170, 95, 20]),
  car: houseAnchor([-170, 95, 25]),
  garden: houseAnchor([-115, 100, 10]),
} as const;

export interface IsoHouseProps extends CanvasProps {
  variant?: 'residential' | 'luxury' | 'room';
  view?: 'exterior' | 'cutaway';
  doorOpen?: number;
  windowLit?: boolean;
  waterRunning?: boolean;
  carInGarage?: boolean;
  carColor?: string;
  garden?: boolean;
  poolColor?: string;
  wallColor?: string;
  roofColor?: string;
  floorColor?: string;
  doorColor?: string;
}

export const IsoHouse: React.FC<IsoHouseProps> = ({
  variant = 'residential',
  view = 'exterior',
  doorOpen = 0,
  windowLit = false,
  waterRunning = false,
  carInGarage,
  carColor,
  garden = true,
  poolColor = '#38B2C6',
  wallColor,
  roofColor,
  floorColor,
  doorColor,
  ...props
}) => {
  const isCutaway = variant === 'room' || view === 'cutaway';
  const openProgress = clamp(doorOpen);
  const angle = openProgress * (Math.PI / 2);
  const glassColor = windowLit ? '#FFE48A' : '#93BAC4';
  const glassGlow = windowLit ? '#FFF6D1' : '#B8D8DF';

  // =========================================================================
  // VARIAN LUXURY: Villa / Rumah Mewah Modern 2 Lantai dengan Kolam, Garasi & Taman
  // =========================================================================
  if (variant === 'luxury') {
    const hasCar = carInGarage ?? true;
    const luxCarColor = carColor || '#243342';
    const luxWall = wallColor || '#F0EFEB';
    const luxRoof = roofColor || '#2B373A';
    const luxFloor = floorColor || '#EAE7DF';
    const luxDoor = doorColor || '#38281D';
    const luxDoorEnd: CarPoint = [
      -40 + Math.cos(angle) * 45,
      36 - Math.sin(angle) * 45,
      12,
    ];

    return (
      <Canvas
        aria-label={
          isCutaway
            ? 'Potongan interior rumah mewah 2 lantai dengan kolam renang, garasi mobil, taman, dan interior lengkap'
            : 'Rumah mewah modern 2 lantai tampak luar dengan garasi mobil, taman asri, kolam renang, dan balkon kaca'
        }
        {...props}
      >
        <Translate scale={0.58}>
          {/* 1. Podium Dasar & Halaman */}
          <Block x={-220} y={-165} w={440} d={335} h={8} color="#D4D9D6" />

          {/* 2. Garasi / Carport Kanopi di Depan Kiri */}
          <g data-part="garage">
            {/* Lantai Carport Paving Semen */}
            <Block x={-210} y={40} w={85} d={115} h={3} color="#B8BEBC" />
            {/* Atap Kanopi Carport Modern Cantilever */}
            <Block x={-215} y={40} z={95} w={85} d={105} h={6} color="#2B373A" />
            {/* Tiang penyangga kanopi depan */}
            <Block x={-135} y={140} z={8} w={5} d={5} h={87} color="#35494B" />

            {/* Mobil Mewah Terparkir di Garasi */}
            {hasCar ? <ParkedCar x={-196} y={55} z={8} color={luxCarColor} /> : null}
          </g>

          {/* 3. Taman Asri & Lanskap Depan (Garden Landscape) */}
          {garden ? (
            <g data-part="garden">
              {/* Rumput hijau antara carport dan jalan setapak masuk */}
              <polygon
                points={points([[-125, 42, 8.2], [-85, 42, 8.2], [-85, 155, 8.2], [-125, 155, 8.2]])}
                fill="#4E8F47"
              />
              {/* Rumput hijau di depan kolam renang */}
              <polygon
                points={points([[-35, 140, 8.2], [15, 140, 8.2], [15, 160, 8.2], [-35, 160, 8.2]])}
                fill="#4E8F47"
              />
              <polygon
                points={points([[188, 45, 8.2], [215, 45, 8.2], [215, 155, 8.2], [188, 155, 8.2]])}
                fill="#4E8F47"
              />

              {/* Batu Pijakan Taman (Garden Stepping Stones) */}
              {[-120, -112, -104, -96].map((sx, idx) => (
                <polygon
                  key={sx}
                  points={points([
                    [sx, 85 + idx * 16, 8.4],
                    [sx + 14, 85 + idx * 16, 8.4],
                    [sx + 14, 95 + idx * 16, 8.4],
                    [sx, 95 + idx * 16, 8.4],
                  ])}
                  fill="#D9DFDC"
                  stroke={ink}
                  strokeWidth={0.8}
                />
              ))}

              {/* Semak-semak hias taman berbunga */}
              <Shrub x={-115} y={55} z={9} r={9} flowerColor="#FF6B4A" />
              <Shrub x={-98} y={145} z={9} r={11} flowerColor="#FFD43F" />
              <Shrub x={-12} y={150} z={9} r={8} flowerColor="#FFFFFF" />
              <Shrub x={202} y={58} z={9} r={9} flowerColor="#FF6B4A" />
              <Shrub x={202} y={142} z={9} r={10} flowerColor="#FFD43F" />

              {/* Pot Tanaman Hias Modern Tropis di Sisi Pintu Masuk */}
              <Block x={-42} y={38} z={10} w={12} d={12} h={16} color="#FFFFFF" />
              <polyline points={points([[-36, 44, 26], [-36, 44, 46], [-42, 44, 52]])} stroke="#468744" strokeWidth={3} strokeLinecap="round" />
              <polyline points={points([[-36, 44, 26], [-30, 40, 48], [-24, 38, 54]])} stroke="#549952" strokeWidth={3} strokeLinecap="round" />
            </g>
          ) : null}

          {/* 4. Jalan Setapak Masuk Teras */}
          <Block x={-85} y={40} w={50} d={115} h={4} color="#E4E9E6" />

          {/* 5. Deck Kayu Teras Depan Kolam (Teak Pool Deck) */}
          <Block x={-35} y={35} w={245} d={125} h={5} color="#A3784A" />
          {[-35, 15, 65, 115, 165].map((lx) => (
            <polyline key={lx} points={points([[lx, 35, 10], [lx, 160, 10]])} stroke="#7D552B" strokeWidth={1} />
          ))}

          {/* 6. Kolam Renang (Plunge Pool / Infinity Swimming Pool) */}
          <g data-part="swimming-pool">
            <Block x={15} y={52} z={2} w={185} d={98} h={8} color="#EAEFEC" />
            <polygon
              points={points([[20, 56, 9.2], [195, 56, 9.2], [195, 146, 9.2], [20, 146, 9.2]])}
              fill={poolColor}
              fillOpacity={0.88}
              stroke={ink}
              strokeWidth={1}
            />
            <polyline
              points={points([[45, 80, 9.5], [115, 80, 9.5]])}
              stroke="#FFFFFF"
              strokeWidth={1.8}
              opacity={0.7}
              strokeLinecap="round"
            />
            <polyline
              points={points([[110, 115, 9.5], [175, 115, 9.5]])}
              stroke="#FFFFFF"
              strokeWidth={1.8}
              opacity={0.7}
              strokeLinecap="round"
            />
            <Block x={22} y={58} z={3} w={45} d={24} h={4} color="#268294" />

            {/* Kursi Santai Tepi Kolam */}
            <Block x={-22} y={62} z={10} w={30} d={68} h={10} color="#FFFFFF" />
            <Block x={-22} y={62} z={20} w={30} d={20} h={14} color="#FFFFFF" />
            <polygon
              points={points([[-18, 68, 21], [4, 68, 21], [4, 120, 21], [-18, 120, 21]])}
              fill="#2EB1C4"
            />
          </g>

          {/* 7. Struktur Lantai 1 */}
          <Block x={-210} y={-155} z={8} w={415} d={190} h={4} color={luxFloor} />
          <Block x={-210} y={-155} z={12} w={415} d={8} h={116} color={luxWall} />
          <Block x={-210} y={-147} z={12} w={8} d={182} h={116} color={luxWall} />
          <Block x={197} y={-147} z={12} w={8} d={182} h={116} color={luxWall} />

          {/* ========================================================= */}
          {/* CUTAWAY INTERIOR MEWAH (LANTAI 1 & LANTAI 2)             */}
          {/* ========================================================= */}
          {isCutaway ? (
            <g data-part="interior">
              {/* --- LANTAI 1: DAPUR MEWAH (GOURMET KITCHEN ISLAND) --- */}
              <g data-part="kitchen">
                <Block x={-180} y={-105} z={12} w={125} d={58} h={64} color="#233234" />
                <Block x={-182} y={-107} z={76} w={129} d={62} h={6} color="#F2F0EB" />

                <g data-part="kitchen-sink">
                  <polygon
                    points={points([[-150, -98, 82.2], [-90, -98, 82.2], [-90, -60, 82.2], [-150, -60, 82.2]])}
                    fill="#B6C4C5"
                    stroke={ink}
                    strokeWidth={1}
                  />
                  <polyline
                    points={points([[-120, -98, 82.4], [-120, -60, 82.4]])}
                    stroke={ink}
                    strokeWidth={1.5}
                  />
                  <polygon points={points([[-138, -82, 82.5], [-132, -82, 82.5], [-132, -76, 82.5], [-138, -76, 82.5]])} fill="#35494B" />
                  <polygon points={points([[-108, -82, 82.5], [-102, -82, 82.5], [-102, -76, 82.5], [-108, -76, 82.5]])} fill="#35494B" />
                </g>

                <g data-part="kitchen-faucet">
                  <Block x={-124} y={-100} z={82} w={8} d={6} h={8} color="#D4AF37" />
                  <polyline
                    points={points([
                      [-120, -97, 90],
                      [-120, -97, 120],
                      [-120, -78, 120],
                      [-120, -78, 110],
                    ])}
                    stroke="#E2B755"
                    strokeWidth={4.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={points([
                      [-120, -97, 90],
                      [-120, -97, 120],
                      [-120, -78, 120],
                      [-120, -78, 110],
                    ])}
                    stroke={ink}
                    strokeWidth={1.2}
                    fill="none"
                  />
                  {waterRunning ? (
                    <g data-part="kitchen-water-stream">
                      <polyline
                        points={points([[-120, -78, 109], [-120, -78, 83]])}
                        stroke="#4FA4B8"
                        strokeWidth={3.5}
                        strokeLinecap="round"
                      />
                      <polyline
                        points={points([[-120, -78, 109], [-120, -78, 83]])}
                        stroke="#DDF6FC"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                      <polyline
                        points={points([[-124, -80, 84], [-120, -78, 83], [-116, -80, 84]])}
                        stroke="#E8F9FD"
                        strokeWidth={2}
                      />
                    </g>
                  ) : null}
                </g>

                {[-160, -115].map((bx) => (
                  <g key={bx}>
                    <Block x={bx} y={-42} z={12} w={18} d={18} h={42} color="#1D2728" />
                    <Block x={bx - 2} y={-44} z={54} w={22} d={22} h={6} color="#856342" />
                  </g>
                ))}

                <Block x={-180} y={-147} z={12} w={125} d={34} h={76} color="#35484A" />
                <Block x={-145} y={-135} z={100} w={55} d={20} h={25} color="#4F6466" />
              </g>

              {/* --- LANTAI 1: KAMAR MANDI MEWAH (LUXURY SPA BATHROOM) --- */}
              <g data-part="bathroom">
                <polygon
                  points={points([[40, -147, 12.3], [197, -147, 12.3], [197, 30, 12.3], [40, 30, 12.3]])}
                  fill="#DDE8E8"
                  stroke="#A8CFD1"
                  strokeWidth={1}
                />
                <Block x={38} y={-147} z={12} w={6} d={177} h={116} color={luxWall} />

                <g data-part="shower-area">
                  <Block x={118} y={-125} z={12} w={68} d={65} h={36} color="#FFFFFF" />
                  <polygon
                    points={points([[124, -119, 48.2], [180, -119, 48.2], [180, -66, 48.2], [124, -66, 48.2]])}
                    fill="#A2C7CD"
                    stroke={ink}
                    strokeWidth={1}
                  />
                  <polyline
                    points={points([[112, -92, 12], [112, -92, 62], [120, -92, 60]])}
                    stroke="#D4AF37"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </g>

                <g data-part="bathroom-sink">
                  <Block x={48} y={-140} z={38} w={62} d={42} h={35} color="#2A3A3D" />
                  <Block x={46} y={-142} z={73} w={66} d={46} h={5} color="#FFFFFF" />
                  <polygon
                    points={points([[52, -134, 78.3], [74, -134, 78.3], [74, -104, 78.3], [52, -104, 78.3]])}
                    fill="#E8F1F2"
                    stroke={ink}
                    strokeWidth={1}
                  />
                  <polygon
                    points={points([[82, -134, 78.3], [104, -134, 78.3], [104, -104, 78.3], [82, -104, 78.3]])}
                    fill="#E8F1F2"
                    stroke={ink}
                    strokeWidth={1}
                  />
                </g>

                <g data-part="bathroom-faucet">
                  <polyline points={points([[63, -136, 78], [63, -136, 92], [63, -126, 90]])} stroke="#CAD9DB" strokeWidth={3} strokeLinecap="round" />
                  <polyline points={points([[93, -136, 78], [93, -136, 92], [93, -126, 90]])} stroke="#CAD9DB" strokeWidth={3} strokeLinecap="round" />
                  {waterRunning ? (
                    <g data-part="bathroom-water-stream">
                      <polyline points={points([[63, -126, 90], [63, -126, 79]])} stroke="#4FA4B8" strokeWidth={2.5} strokeLinecap="round" />
                      <polyline points={points([[93, -126, 90], [93, -126, 79]])} stroke="#4FA4B8" strokeWidth={2.5} strokeLinecap="round" />
                    </g>
                  ) : null}
                </g>

                <Block x={50} y={-146} z={92} w={58} d={2} h={30} color="#35494B" />
                <polygon
                  points={points([[52, -145, 94], [106, -145, 94], [106, -145, 120], [52, -145, 120]])}
                  fill="#CFE6EB"
                />
              </g>

              {/* --- LANTAI 1: LIVING LOUNGE MEWAH --- */}
              <g data-part="living-room">
                <Block x={-50} y={-45} z={12} w={75} d={45} h={26} color="#3E5456" />
                <Block x={-50} y={0} z={12} w={40} d={35} h={26} color="#3E5456" />
                <Block x={-5} y={-20} z={16} w={42} d={38} h={8} color="#FFFFFF" />
              </g>

              {/* --- LANTAI 2: MASTER SUITE & CANTILEVER BALCONY --- */}
              <g data-part="upper-floor">
                <Block x={-215} y={-160} z={128} w={425} d={200} h={8} color="#2B373A" />
                <Block x={-205} y={-152} z={136} w={295} d={8} h={90} color={luxWall} />
                <Block x={-205} y={-144} z={136} w={8} d={174} h={90} color={luxWall} />

                <Block x={-170} y={-110} z={136} w={80} d={75} h={20} color="#455B5E" />
                <Block x={-165} y={-105} z={156} w={70} d={65} h={12} color="#FFFFFF" />
                <Block x={-160} y={-105} z={168} w={30} d={18} h={6} color="#D4AF37" />

                <g data-part="balcony">
                  <polygon
                    points={points([[-170, 36, 136], [70, 36, 136], [70, 36, 172], [-170, 36, 172]])}
                    fill="#A2D4DF"
                    fillOpacity={0.65}
                    stroke={ink}
                    strokeWidth={1}
                  />
                  <polyline
                    points={points([[-170, 36, 172], [70, 36, 172]])}
                    stroke="#2B373A"
                    strokeWidth={3}
                  />
                </g>

                <Block x={-220} y={-165} z={226} w={335} d={210} h={10} color={luxRoof} />
              </g>
            </g>
          ) : null}

          {/* ========================================================= */}
          {/* FASAD EKSTERIOR RUMAH MEWAH 2 LANTAI                      */}
          {/* ========================================================= */}
          {!isCutaway ? (
            <g data-part="exterior">
              <Block x={-205} y={35} z={12} w={160} d={8} h={116} color={luxWall} />
              <Block x={10} y={35} z={12} w={35} d={8} h={116} color="#7E8B89" />
              <Block x={45} y={35} z={12} w={152} d={8} h={116} color={luxWall} />

              <g data-part="window-front">
                <polygon
                  points={points([[-185, 43, 25], [-65, 43, 25], [-65, 43, 115], [-185, 43, 115]])}
                  fill={glassColor}
                  stroke={ink}
                  strokeWidth={1.5}
                />
                <polyline points={points([[-125, 43, 25], [-125, 43, 115]])} stroke={ink} strokeWidth={2} />
                <polyline points={points([[-165, 43.5, 35], [-135, 43.5, 95]])} stroke={glassGlow} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
              </g>

              <g data-part="front-door">
                <polygon
                  data-part="door-leaf"
                  points={points([
                    [-40, 36, 12],
                    [luxDoorEnd[0], luxDoorEnd[1], 12],
                    [luxDoorEnd[0], luxDoorEnd[1], 118],
                    [-40, 36, 118],
                  ])}
                  fill={luxDoor}
                  stroke={ink}
                  strokeWidth={2}
                />
                <polyline
                  data-part="door-handle"
                  points={points([
                    [-40 + Math.cos(angle) * 38, 37 - Math.sin(angle) * 38, 45],
                    [-40 + Math.cos(angle) * 38, 37 - Math.sin(angle) * 38, 85],
                  ])}
                  stroke="#E2B755"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              </g>

              <Block x={-215} y={-160} z={128} w={425} d={200} h={8} color="#2B373A" />

              <g data-part="upper-facade">
                <Block x={-205} y={-5} z={136} w={125} d={8} h={90} color={luxWall} />

                <polygon
                  points={points([[-195, 3, 148], [-105, 3, 148], [-105, 3, 215], [-195, 3, 215]])}
                  fill={glassColor}
                  stroke={ink}
                  strokeWidth={1.5}
                />

                {[-75, -55, -35, -15, 5, 25, 45].map((sx) => (
                  <Block key={sx} x={sx} y={-2} z={136} w={8} d={4} h={90} color="#8D643E" />
                ))}

                <g data-part="balcony">
                  <polygon
                    points={points([[-170, 36, 136], [70, 36, 136], [70, 36, 172], [-170, 36, 172]])}
                    fill="#A2D4DF"
                    fillOpacity={0.65}
                    stroke={ink}
                    strokeWidth={1}
                  />
                  <polyline
                    points={points([[-170, 36, 172], [70, 36, 172]])}
                    stroke="#2B373A"
                    strokeWidth={3}
                  />
                </g>

                <g data-part="roof">
                  <Block x={-220} y={-165} z={226} w={335} d={210} h={10} color={luxRoof} />
                </g>
              </g>
            </g>
          ) : null}
        </Translate>
      </Canvas>
    );
  }

  // =========================================================================
  // VARIAN RESIDENTIAL / ROOM: Rumah Tinggal Keluarga (Standar)
  // =========================================================================
  const resWall = wallColor || '#E3DDCF';
  const resRoof = roofColor || '#9C4B3E';
  const resFloor = floorColor || '#C4A882';
  const resDoor = doorColor || '#5D4037';
  const resCarColor = carColor || '#CF5A3C';
  const doorWidth = 76;
  const doorEnd: CarPoint = [
    40 + Math.cos(angle) * doorWidth,
    146 - Math.sin(angle) * doorWidth,
    14,
  ];

  return (
    <Canvas
      aria-label={
        variant === 'room'
          ? 'Potongan ruangan interior rumah dengan perabot, dapur, dan kamar mandi'
          : isCutaway
            ? 'Potongan interior rumah tinggal keluarga lengkap dengan dapur, kamar mandi, dan taman'
            : 'Rumah tinggal keluarga tampak luar dengan atap pelana, taman, dan teras'
      }
      {...props}
    >
      <Translate scale={0.65}>
        {/* Foundation & garden pathway */}
        <Block x={-200} y={-160} w={400} d={320} h={8} color="#C4C9BE" />
        <Block x={20} y={160} w={80} d={45} h={4} color="#D8DFD4" />

        {/* Taman Halaman Depan Rumah Standar */}
        {garden ? (
          <g data-part="garden">
            {/* Rumput hijau di sisi kiri teras */}
            <polygon
              points={points([[-195, 115, 8.2], [-30, 115, 8.2], [-30, 158, 8.2], [-195, 158, 8.2]])}
              fill="#52994B"
            />
            {/* Batu pijakan taman */}
            {[-160, -125, -90, -55].map((sx, idx) => (
              <polygon
                key={sx}
                points={points([
                  [sx, 125 + (idx % 2) * 10, 8.4],
                  [sx + 16, 125 + (idx % 2) * 10, 8.4],
                  [sx + 16, 138 + (idx % 2) * 10, 8.4],
                  [sx, 138 + (idx % 2) * 10, 8.4],
                ])}
                fill="#D8DFDB"
                stroke={ink}
                strokeWidth={0.8}
              />
            ))}
            {/* Semak tanaman hias */}
            <Shrub x={-180} y={120} z={9} r={9} flowerColor="#FF6B4A" />
            <Shrub x={-45} y={120} z={9} r={10} flowerColor="#FFD43F" />
            <Shrub x={-175} y={150} z={9} r={8} flowerColor="#FFFFFF" />
          </g>
        ) : null}

        {/* Carport / Driveway sisi kanan (jika carInGarage aktif) */}
        {carInGarage ? (
          <g data-part="garage">
            <Block x={110} y={60} w={85} d={95} h={3} color="#BEC5C2" />
            <ParkedCar x={128} y={70} z={4} color={resCarColor} />
          </g>
        ) : null}

        {/* Interior floor (parquet wood for living & kitchen area) */}
        <Block x={-190} y={-150} z={8} w={380} d={300} h={4} color={resFloor} />
        {/* Floor planks detail */}
        {[-80, -10, 60, 130].map((lineX) => (
          <polyline
            key={lineX}
            points={points([[lineX, -150, 12], [lineX, 150, 12]])}
            stroke="#A38865"
            strokeWidth={1}
            opacity={0.4}
          />
        ))}

        {/* Back wall */}
        <Block x={-190} y={-150} z={12} w={380} d={8} h={210} color={resWall} />

        {/* Left wall */}
        <Block x={-190} y={-142} z={12} w={8} d={284} h={210} color={resWall} />

        {/* Interior Elements (shown in cutaway mode or room variant) */}
        {isCutaway ? (
          <g data-part="interior">
            {/* 1. DAPUR (KITCHEN) */}
            <g data-part="kitchen">
              <Block x={-182} y={-142} z={12} w={228} d={54} h={74} color="#DCE3E1" />
              <Block x={-184} y={-144} z={86} w={232} d={58} h={6} color="#3F5251" />

              <polygon
                points={points([[-165, -135, 92.5], [-125, -135, 92.5], [-125, -100, 92.5], [-165, -100, 92.5]])}
                fill="#263534"
                stroke={ink}
                strokeWidth={1}
              />
              <polyline points={points([[-150, -125, 93], [-140, -125, 93]])} stroke="#FF7E54" strokeWidth={2} />
              <polyline points={points([[-150, -110, 93], [-140, -110, 93]])} stroke="#FF7E54" strokeWidth={2} />
              <Block x={-152} y={-124} z={93} w={18} d={18} h={14} color="#D16345" />

              <g data-part="kitchen-sink">
                <polygon
                  points={points([[-95, -138, 92.2], [-35, -138, 92.2], [-35, -96, 92.2], [-95, -96, 92.2]])}
                  fill="#B5C3C4"
                  stroke={ink}
                  strokeWidth={1.2}
                />
                <polygon
                  points={points([[-90, -134, 92.4], [-40, -134, 92.4], [-40, -100, 92.4], [-90, -100, 92.4]])}
                  fill="#869CA0"
                  stroke={ink}
                  strokeWidth={1}
                />
                <polygon
                  points={points([[-68, -120, 92.6], [-62, -120, 92.6], [-62, -114, 92.6], [-68, -114, 92.6]])}
                  fill="#35494B"
                />
              </g>

              <g data-part="kitchen-faucet">
                <Block x={-68} y={-140} z={92} w={12} d={8} h={6} color="#7A9398" />
                <polyline
                  points={points([
                    [-62, -136, 98],
                    [-62, -136, 126],
                    [-62, -120, 126],
                    [-62, -117, 116],
                  ])}
                  stroke="#CAD9DB"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={points([
                    [-62, -136, 98],
                    [-62, -136, 126],
                    [-62, -120, 126],
                    [-62, -117, 116],
                  ])}
                  stroke={ink}
                  strokeWidth={1.3}
                  fill="none"
                />
                <polyline
                  points={points([[-56, -136, 106], [-50, -136, 112]])}
                  stroke="#E2B755"
                  strokeWidth={3}
                  strokeLinecap="round"
                />

                {waterRunning ? (
                  <g data-part="kitchen-water-stream">
                    <polyline
                      points={points([[-62, -117, 115], [-62, -117, 93]])}
                      stroke="#4FA4B8"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                    />
                    <polyline
                      points={points([[-62, -117, 115], [-62, -117, 93]])}
                      stroke="#AEE5F0"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    <polyline
                      points={points([[-66, -119, 94], [-62, -117, 93], [-58, -119, 94]])}
                      stroke="#E3F7FB"
                      strokeWidth={2}
                    />
                  </g>
                ) : null}
              </g>

              <Block x={-175} y={-142} z={145} w={120} d={24} h={52} color="#E4EAE6" />
              <polyline points={points([[-115, -118, 145], [-115, -118, 197]])} stroke={ink} strokeWidth={1.2} />
              <polyline points={points([[-120, -117, 165], [-120, -117, 175]])} stroke="#35494B" strokeWidth={2} />
              <polyline points={points([[-110, -117, 165], [-110, -117, 175]])} stroke="#35494B" strokeWidth={2} />
            </g>

            {/* 2. KAMAR MANDI (BATHROOM) */}
            <g data-part="bathroom">
              <polygon
                points={points([[48, -142, 12.3], [182, -142, 12.3], [182, 18, 12.3], [48, 18, 12.3]])}
                fill="#D4EAEB"
                stroke="#A8CFD1"
                strokeWidth={1}
              />
              {[95, 140].map((tx) => (
                <polyline key={tx} points={points([[tx, -142, 12.5], [tx, 18, 12.5]])} stroke="#99C0C2" strokeWidth={1} />
              ))}
              {[-90, -36].map((ty) => (
                <polyline key={ty} points={points([[48, ty, 12.5], [182, ty, 12.5]])} stroke="#99C0C2" strokeWidth={1} />
              ))}

              <Block x={46} y={-142} z={12} w={6} d={160} h={210} color={resWall} />
              <Block x={46} y={18} z={12} w={45} d={6} h={210} color={resWall} />
              <Block x={135} y={18} z={12} w={47} d={6} h={210} color={resWall} />
              <Block x={91} y={18} z={170} w={44} d={6} h={52} color={resWall} />

              <g data-part="bathroom-sink">
                <Block x={56} y={-138} z={12} w={48} d={40} h={68} color="#EDF2F0" />
                <Block x={54} y={-140} z={80} w={52} d={44} h={5} color="#FFFFFF" />
                <polygon
                  points={points([[62, -132, 85.3], [98, -132, 85.3], [98, -104, 85.3], [62, -104, 85.3]])}
                  fill="#E6F0F2"
                  stroke={ink}
                  strokeWidth={1.2}
                />
                <polygon
                  points={points([[66, -128, 85.5], [94, -128, 85.5], [94, -108, 85.5], [66, -108, 85.5]])}
                  fill="#99B5B8"
                />
                <polygon
                  points={points([[78, -120, 85.6], [82, -120, 85.6], [82, -116, 85.6], [78, -116, 85.6]])}
                  fill="#35494B"
                />
              </g>

              <g data-part="bathroom-faucet">
                <Block x={77} y={-136} z={85} w={6} d={6} h={12} color="#CAD9DB" />
                <polyline
                  points={points([[80, -133, 97], [80, -123, 97], [80, -123, 92]])}
                  stroke="#CAD9DB"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <polyline
                  points={points([[80, -133, 97], [80, -123, 97], [80, -123, 92]])}
                  stroke={ink}
                  strokeWidth={1}
                  fill="none"
                />
                <polyline
                  points={points([[76, -133, 97], [84, -133, 97]])}
                  stroke="#E2B755"
                  strokeWidth={2}
                />

                {waterRunning ? (
                  <g data-part="bathroom-water-stream">
                    <polyline
                      points={points([[80, -123, 91], [80, -123, 86]])}
                      stroke="#4FA4B8"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    <polyline
                      points={points([[80, -123, 91], [80, -123, 86]])}
                      stroke="#E3F7FB"
                      strokeWidth={1}
                      strokeLinecap="round"
                    />
                  </g>
                ) : null}
              </g>

              <Block x={64} y={-141} z={110} w={32} d={2} h={50} color="#35494B" />
              <polygon
                points={points([[66, -140, 113], [94, -140, 113], [94, -140, 157], [66, -140, 157]])}
                fill="#CEE7EB"
              />

              <g data-part="shower-area">
                <Block x={118} y={-138} z={12} w={60} d={75} h={36} color="#FFFFFF" />
                <polygon
                  points={points([[124, -132, 48.2], [172, -132, 48.2], [172, -69, 48.2], [124, -69, 48.2]])}
                  fill="#A2C3C7"
                  stroke={ink}
                  strokeWidth={1}
                />
                <polyline
                  points={[
                    points([[150, -140, 48], [150, -140, 165], [150, -125, 165]]),
                  ]}
                  stroke="#BAC9CB"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <polygon
                  points={points([[144, -123, 166], [156, -123, 166], [156, -118, 161], [144, -118, 161]])}
                  fill="#7A9398"
                  stroke={ink}
                  strokeWidth={1}
                />
                <Block x={146} y={-140} z={90} w={8} d={4} h={8} color="#E2B755" />
              </g>
            </g>

            {/* 3. RUANG TAMU */}
            <g data-part="living-room">
              <polygon
                points={points([[-165, -20, 12.5], [-35, -20, 12.5], [-35, 105, 12.5], [-165, 105, 12.5]])}
                fill="#DED2BD"
                stroke="#BFAFA0"
                strokeWidth={1}
              />
              <g data-part="sofa">
                <Block x={-155} y={-10} z={12} w={105} d={48} h={24} color="#4A6A69" />
                <Block x={-155} y={-10} z={36} w={105} d={16} h={32} color="#3C5655" />
                <Block x={-159} y={-10} z={12} w={10} d={48} h={36} color="#3C5655" />
                <Block x={-56} y={-10} z={12} w={10} d={48} h={36} color="#3C5655" />
                <polygon
                  points={points([[-146, 8, 36.5], [-105, 8, 36.5], [-105, 36, 36.5], [-146, 36, 36.5]])}
                  fill="#C6D6D2"
                  stroke={ink}
                  strokeWidth={1}
                />
                <polygon
                  points={points([[-101, 8, 36.5], [-60, 8, 36.5], [-60, 36, 36.5], [-101, 36, 36.5]])}
                  fill="#C6D6D2"
                  stroke={ink}
                  strokeWidth={1}
                />
              </g>

              <g data-part="table">
                <Block x={-135} y={55} z={18} w={70} d={36} h={6} color="#8D6B47" />
                <Block x={-133} y={57} z={12} w={6} d={6} h={6} color="#553F2B" />
                <Block x={-71} y={57} z={12} w={6} d={6} h={6} color="#553F2B" />
                <Block x={-133} y={83} z={12} w={6} d={6} h={6} color="#553F2B" />
                <Block x={-71} y={83} z={12} w={6} d={6} h={6} color="#553F2B" />
                <Block x={-105} y={68} z={24} w={12} d={10} h={6} color="#E8ECE9" />
              </g>

              <g data-part="lamp">
                <Block x={-170} y={-30} z={12} w={14} d={14} h={4} color="#485D5A" />
                <polyline points={points([[-163, -23, 16], [-163, -23, 115]])} stroke={ink} strokeWidth={2.5} />
                <Block x={-171} y={-31} z={115} w={16} d={16} h={18} color={windowLit ? '#FFEAA3' : '#E8E2D2'} />
              </g>

              <g data-part="plant">
                <Block x={16} y={50} z={12} w={16} d={16} h={18} color="#C46E52" />
                <polyline points={points([[24, 58, 30], [20, 54, 46], [28, 52, 52]])} stroke="#548255" strokeWidth={3} strokeLinecap="round" />
                <polyline points={points([[24, 58, 30], [30, 62, 42], [34, 65, 48]])} stroke="#639864" strokeWidth={3} strokeLinecap="round" />
              </g>
            </g>
          </g>
        ) : null}

        {/* 4. EKSTERIOR (FASAD & ATAP PELANA) */}
        {!isCutaway ? (
          <g data-part="exterior">
            <Block x={182} y={-142} z={12} w={8} d={284} h={210} color={resWall} />
            <Block x={-190} y={142} z={12} w={230} d={8} h={210} color={resWall} />
            <Block x={116} y={142} z={12} w={66} d={8} h={210} color={resWall} />
            <Block x={40} y={142} z={174} w={76} d={8} h={48} color={resWall} />

            <g data-part="window-front">
              <Block x={-165} y={147} z={60} w={140} d={5} h={105} color="#405553" />
              <Block x={-170} y={149} z={56} w={150} d={8} h={6} color="#2F4240" />
              {[
                { px: -160, pz: 65, pw: 62, ph: 45 },
                { px: -92, pz: 65, pw: 62, ph: 45 },
                { px: -160, pz: 114, pw: 62, ph: 45 },
                { px: -92, pz: 114, pw: 62, ph: 45 },
              ].map(({ px, pz, pw, ph }, i) => (
                <polygon
                  key={i}
                  points={points([[px, 150, pz], [px + pw, 150, pz], [px + pw, 150, pz + ph], [px, 150, pz + ph]])}
                  fill={glassColor}
                  stroke={ink}
                  strokeWidth={1}
                />
              ))}
            </g>

            <g data-part="front-door">
              <Block x={38} y={144} z={10} w={80} d={6} h={4} color="#7E6852" />
              <polygon
                data-part="door-leaf"
                points={points([
                  [40, 146, 14],
                  [doorEnd[0], doorEnd[1], 14],
                  [doorEnd[0], doorEnd[1], 172],
                  [40, 146, 172],
                ])}
                fill={resDoor}
                stroke={ink}
                strokeWidth={2}
              />
              <polyline
                data-part="door-handle"
                points={points([
                  [40 + Math.cos(angle) * 64, 147 - Math.sin(angle) * 64, 88],
                  [40 + Math.cos(angle) * 64, 147 - Math.sin(angle) * 64, 104],
                ])}
                stroke="#E2B755"
                strokeWidth={3.5}
                strokeLinecap="round"
              />
              <Block x={30} y={146} z={176} w={96} d={36} h={8} color={resRoof} />
            </g>

            <g data-part="roof">
              <polygon
                points={points([[-190, -142, 222], [-190, 0, 305], [-190, 142, 222]])}
                fill={resWall}
                stroke={ink}
                strokeWidth={1.3}
              />
              <polygon
                points={points([[182, -142, 222], [182, 0, 305], [182, 142, 222]])}
                fill={resWall}
                stroke={ink}
                strokeWidth={1.3}
              />
              <polygon
                points={points([[-205, 0, 310], [205, 0, 310], [205, -165, 215], [-205, -165, 215]])}
                fill={resRoof}
                stroke={ink}
                strokeWidth={1.3}
              />
              <Block x={-132} y={-60} z={245} w={38} d={38} h={95} color="#8D4C3E" />
              <polygon
                points={points([[-205, 0, 310], [205, 0, 310], [205, 165, 215], [-205, 165, 215]])}
                fill={resRoof}
                stroke={ink}
                strokeWidth={1.3}
              />
              {[238, 262, 286].map((rz, i) => {
                const ry = 165 - ((rz - 215) / 95) * 165;
                return (
                  <polyline
                    key={i}
                    points={points([[-204, ry, rz], [204, ry, rz]])}
                    stroke="#733227"
                    strokeWidth={2}
                    opacity={0.6}
                  />
                );
              })}
              <polygon
                points={points([[-206, -6, 312], [206, -6, 312], [206, 6, 312], [-206, 6, 312]])}
                fill="#7E372C"
                stroke={ink}
                strokeWidth={1.3}
              />
              <polygon
                points={points([[-205, 165, 215], [205, 165, 215], [205, 165, 207], [-205, 165, 207]])}
                fill="#6E3026"
                stroke={ink}
                strokeWidth={1.3}
              />
            </g>
          </g>
        ) : null}
      </Translate>
    </Canvas>
  );
};

// =========================================================================
// ISO SINK (Komponen Wastafel dan Keran Air Close-Up)
// =========================================================================

export const ISO_SINK_ANCHORS = {
  faucet: [0, -35, 125],
  spout: [0, -10, 115],
  basin: [0, 0, 80],
  drain: [0, 5, 55],
  trap: [0, 5, -20],
  inlet: [-35, -35, -15],
} as const;

export interface IsoSinkProps extends CanvasProps {
  variant?: 'kitchen' | 'bathroom';
  waterRunning?: boolean;
  counterColor?: string;
  basinColor?: string;
}

export const IsoSink: React.FC<IsoSinkProps> = ({
  variant = 'kitchen',
  waterRunning = false,
  counterColor = '#3F5251',
  basinColor = '#B8C7C8',
  ...props
}) => {
  const isBathroom = variant === 'bathroom';

  return (
    <Canvas
      aria-label={
        isBathroom
          ? 'Wastafel kamar mandi dengan keran air dan cermin'
          : 'Wastafel cuci piring dapur dengan keran leher angsa dan saluran pipa'
      }
      {...props}
    >
      <Translate scale={1.2}>
        <Block x={-95} y={-70} w={190} d={140} h={110} color={isBathroom ? '#EDF2EF' : '#D0DDD9'} />
        <polyline points={points([[0, 70, 0], [0, 70, 110]])} stroke={ink} strokeWidth={1.3} />
        <polyline points={points([[-12, 70, 60], [-12, 70, 75]])} stroke="#35494B" strokeWidth={2.5} />
        <polyline points={points([[12, 70, 60], [12, 70, 75]])} stroke="#35494B" strokeWidth={2.5} />

        <Block x={-100} y={-75} z={110} w={200} d={150} h={10} color={counterColor} />

        <g data-part="sink-basin">
          <polygon
            points={points([[-75, -55, 120.5], [75, -55, 120.5], [75, 55, 120.5], [-75, 55, 120.5]])}
            fill={basinColor}
            stroke={ink}
            strokeWidth={1.5}
          />
          <polygon
            points={points([[-65, -45, 120.8], [65, -45, 120.8], [65, 45, 120.8], [-65, 45, 120.8]])}
            fill="#7F989C"
            stroke={ink}
            strokeWidth={1.2}
          />
          <polygon
            points={points([[-15, -5, 121], [15, -5, 121], [15, 15, 121], [-15, 15, 121]])}
            fill="#35494B"
          />
          <polygon
            points={points([[-10, 0, 121.2], [10, 0, 121.2], [10, 10, 121.2], [-10, 10, 121.2]])}
            fill="#B4C5C6"
          />
        </g>

        <g data-part="faucet">
          <Block x={-15} y={-68} z={120} w={30} d={18} h={10} color="#859CA0" />

          {isBathroom ? (
            <g>
              <Block x={-6} y={-60} z={130} w={12} d={12} h={30} color="#CAD9DB" />
              <polyline
                points={points([[0, -54, 160], [0, -25, 160], [0, -20, 148]])}
                stroke="#CAD9DB"
                strokeWidth={6}
                strokeLinecap="round"
              />
              <polyline
                points={points([[0, -54, 160], [0, -25, 160], [0, -20, 148]])}
                stroke={ink}
                strokeWidth={1.3}
                fill="none"
              />
              <polyline
                points={points([[0, -54, 162], [0, -66, 172]])}
                stroke="#E2B755"
                strokeWidth={4}
                strokeLinecap="round"
              />
            </g>
          ) : (
            <g>
              <polyline
                points={points([
                  [0, -58, 130],
                  [0, -58, 205],
                  [0, -10, 205],
                  [0, -5, 185],
                ])}
                stroke="#CAD9DB"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={points([
                  [0, -58, 130],
                  [0, -58, 205],
                  [0, -10, 205],
                  [0, -5, 185],
                ])}
                stroke={ink}
                strokeWidth={1.5}
                fill="none"
              />
              <polyline
                points={points([[12, -58, 150], [24, -58, 164]])}
                stroke="#E2B755"
                strokeWidth={4.5}
                strokeLinecap="round"
              />
            </g>
          )}

          {waterRunning ? (
            <g data-part="water-stream">
              <polyline
                points={points(
                  isBathroom
                    ? [[0, -20, 146], [0, -5, 122]]
                    : [[0, -5, 182], [0, 5, 122]]
                )}
                stroke="#4FA4B8"
                strokeWidth={5}
                strokeLinecap="round"
              />
              <polyline
                points={points(
                  isBathroom
                    ? [[0, -20, 146], [0, -5, 122]]
                    : [[0, -5, 182], [0, 5, 122]]
                )}
                stroke="#D8F5FC"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <polygon
                points={points([[-14, 0, 121.5], [14, 0, 121.5], [14, 14, 121.5], [-14, 14, 121.5]])}
                fill="#4FA4B8"
                opacity={0.6}
              />
              <polyline
                points={points([[-8, 2, 122], [0, 5, 123], [8, 2, 122]])}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </g>
      </Translate>
    </Canvas>
  );
};
