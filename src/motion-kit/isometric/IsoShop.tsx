import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

type ProductKind = 'box' | 'bottle' | 'can';
const clamp = (n: number, max = 1) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const ink = '#35494B';
const points = (p: readonly CarPoint[]) => carPoints(p);

function Block({ x, y, z = 0, w, d, h, color }: { x: number; y: number; z?: number; w: number; d: number; h: number; color: string }) {
  const a: CarPoint = [x, y, z], b: CarPoint = [x + w, y, z], c: CarPoint = [x + w, y + d, z], e: CarPoint = [x, y + d, z];
  const top = ([px, py, pz]: CarPoint): CarPoint => [px, py, pz + h];
  return <g stroke={ink} strokeWidth={1.3} strokeLinejoin="round">
    <polygon points={points([b, c, top(c), top(b)])} fill={color} />
    <polygon points={points([b, c, top(c), top(b)])} fill="#000" opacity={0.18} />
    <polygon points={points([e, c, top(c), top(e)])} fill={color} />
    <polygon points={points([top(a), top(b), top(c), top(e)])} fill={color} />
  </g>;
}

function Translate({ x = 0, y = 0, z = 0, scale = 1, children }: { x?: number; y?: number; z?: number; scale?: number; children: React.ReactNode }) {
  const p = projectCarPoint([x, y, z]);
  return <g transform={`translate(${p.x} ${p.y}) scale(${scale}) translate(-380 -300)`}>{children}</g>;
}

function ProductShape({ variant = 'box', color = '#CB8154' }: { variant?: ProductKind; color?: string }) {
  if (variant === 'box') return <g data-part="product-box">
    <Block x={-16} y={-12} w={32} d={24} h={42} color={color} />
    <polygon points={points([[-5, -12, 42], [5, -12, 42], [5, 12, 42], [-5, 12, 42]])} fill="#EADFC1" />
    <polygon points={points([[-10, 12, 12], [10, 12, 12], [10, 12, 27], [-10, 12, 27]])} fill="#F5ECD8" />
  </g>;
  const bottle = variant === 'bottle';
  const p = projectCarPoint([0, 0, 0]);
  const r = bottle ? 12 : 15, h = bottle ? 38 : 40;
  const rx = r * Math.sqrt(1.5), ry = r / Math.sqrt(2);
  return <g data-part={`product-${variant}`} transform={`translate(${p.x} ${p.y})`} stroke={ink} strokeWidth={1.3}>
    <path d={`M${-rx} ${-h} A${rx} ${ry} 0 0 1 ${rx} ${-h} L${rx} 0 A${rx} ${ry} 0 0 1 ${-rx} 0 Z`} fill={color} />
    <ellipse cy={-h} rx={rx} ry={ry} fill={color} />
    <path d={`M${-rx} -12 Q0 -5 ${rx} -12 L${rx} -25 Q0 -18 ${-rx} -25 Z`} fill="#F5ECD8" stroke="none" />
    {bottle ? <><path d={`M${-rx} -38 L-6 -47 V-56 H6 V-47 L${rx} -38`} fill={color} /><ellipse cy={-56} rx={7} ry={4} fill={ink} /></> : <><ellipse cy={-h} rx={rx * 0.7} ry={ry * 0.7} fill="none" /><ellipse cx={2} cy={-h} rx={4} ry={2} fill={ink} /></>}
  </g>;
}

function ShelfShape({ stockCount = 6, color = '#8A9B98', productColor = '#CB8154', highlight = 0 }: { stockCount?: number; color?: string; productColor?: string; highlight?: number }) {
  const count = Math.round(clamp(stockCount, 6));
  return <g data-part="shelf">
    <Block x={-110} y={-35} w={220} d={8} h={195} color={color} />
    <Block x={-114} y={-35} w={8} d={75} h={195} color={color} />
    <Block x={106} y={-35} w={8} d={75} h={195} color={color} />
    {[8, 74, 140].map((z, row) => <g key={z}>
      <Block x={-106} y={-27} z={z} w={212} d={68} h={6} color={color} />
      {[0, 1].map((col) => row * 2 + col < count ? <Translate key={col} x={col === 0 ? -55 : 55} y={5} z={z + 6} scale={0.8}>
        <ProductShape variant={(['box', 'bottle', 'can'] as const)[row]} color={productColor} />
      </Translate> : null)}
      <polygon points={points([[-104, 42, z + 6], [104, 42, z + 6], [104, 42, z], [-104, 42, z]])} fill="#F6E7A1" opacity={clamp(highlight)} />
    </g>)}
  </g>;
}

function PosShape({ color = '#425C62', active = false }: { color?: string; active?: boolean }) {
  return <g data-part="pos-terminal">
    <Block x={-35} y={-25} w={70} d={50} h={8} color={color} />
    <Block x={-6} y={-8} z={8} w={12} d={16} h={48} color={color} />
    <Block x={-45} y={-12} z={48} w={90} d={10} h={62} color={color} />
    <polygon data-part="pos-screen" points={points([[-39, -1, 56], [39, -1, 56], [39, -1, 103], [-39, -1, 103]])} fill={active ? '#8CCAC1' : '#233438'} />
    {active ? [0, 1, 2].map((row) => <polyline key={row} points={points([[-29, 0, 92 - row * 12], [row === 2 ? 5 : 27, 0, 92 - row * 12]])} stroke="#E9F3E7" strokeWidth={4} />) : null}
    <Block x={-28} y={18} z={8} w={56} d={23} h={7} color="#A3B3AC" />
  </g>;
}

export function checkoutProductPoint(progress: number): CarPoint {
  const p = clamp(progress);
  return [-85 + p * 170, 0, 108];
}

function CounterShape({ color = '#AE8D6C', productColor = '#CB8154', scanProgress = 0, drawerOpen = 0, active = false }: { color?: string; productColor?: string; scanProgress?: number; drawerOpen?: number; active?: boolean }) {
  return <g data-part="checkout-counter">
    <Block x={-160} y={-55} w={320} d={110} h={96} color={color} />
    <Block x={-168} y={-62} z={96} w={336} d={124} h={12} color="#DEE3DB" />
    <Translate x={110} y={-28} z={108} scale={0.65}><PosShape active={active} /></Translate>
    <Block x={-15} y={-22} z={108} w={30} d={44} h={2} color="#35494B" />
    {active ? <polyline data-part="scanner-light" points={points([[-14, 0, 111], [14, 0, 111]])} stroke="#E28563" strokeWidth={3} /> : null}
    <Translate x={checkoutProductPoint(scanProgress)[0]} z={108}><ProductShape color={productColor} /></Translate>
    <g data-part="cash-drawer">
      <Block x={-48} y={48 + clamp(drawerOpen) * 70} z={55} w={96} d={12 + clamp(drawerOpen) * 38} h={15} color="#4B5D5E" />
      <polyline points={points([[-15, 62 + clamp(drawerOpen) * 108, 61], [15, 62 + clamp(drawerOpen) * 108, 61]])} stroke="#DDE4DE" strokeWidth={3} />
    </g>
  </g>;
}

type CanvasProps = React.SVGProps<SVGSVGElement>;
function Canvas({ children, style, ...props }: CanvasProps) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" role="img" {...props} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>{children}</svg>;
}
export interface IsoProductProps extends CanvasProps { variant?: ProductKind; color?: string; lift?: number }
export const IsoProduct: React.FC<IsoProductProps> = ({ variant = 'box', color, lift = 0, ...props }) => <Canvas aria-label="Produk kemasan generik tanpa merek" {...props}><Translate z={clamp(lift, 80)} scale={3}><ProductShape variant={variant} color={color} /></Translate></Canvas>;
export interface IsoShelfProps extends CanvasProps { stockCount?: number; color?: string; productColor?: string; highlight?: number }
export const IsoShelf: React.FC<IsoShelfProps> = ({ stockCount, color, productColor, highlight, ...props }) => <Canvas aria-label="Rak tiga tingkat dengan produk generik" {...props}><ShelfShape stockCount={stockCount} color={color} productColor={productColor} highlight={highlight} /></Canvas>;
export interface IsoPosTerminalProps extends CanvasProps { color?: string; active?: boolean }
export const IsoPosTerminal: React.FC<IsoPosTerminalProps> = ({ color, active, ...props }) => <Canvas aria-label="Terminal POS generik tanpa harga atau merek" {...props}><Translate scale={2}><PosShape color={color} active={active} /></Translate></Canvas>;
export interface IsoCheckoutProps extends CanvasProps { color?: string; productColor?: string; scanProgress?: number; drawerOpen?: number; active?: boolean }
export const IsoCheckout: React.FC<IsoCheckoutProps> = ({ color, productColor, scanProgress, drawerOpen, active, ...props }) => <Canvas aria-label="Meja kasir dengan pemindai, produk dan terminal POS" {...props}><CounterShape color={color} productColor={productColor} scanProgress={scanProgress} drawerOpen={drawerOpen} active={active} /></Canvas>;

const shopAnchor = ([x, y, z]: CarPoint): CarPoint => [x * 0.65, y * 0.65, z * 0.65];
export const ISO_SHOP_ANCHORS = { entrance: shopAnchor([85, 150, 85]), sign: shopAnchor([0, 155, 215]), shelf: shopAnchor([-45, -110, 140]), checkout: shopAnchor([70, 50, 65]), pos: shopAnchor([130, 35, 125]) } as const;
export const ISO_SHELF_ANCHORS = { upper: [0, 0, 160], middle: [0, 0, 95], lower: [0, 0, 30] } as const;
export const ISO_CHECKOUT_ANCHORS = { scanner: [0, 0, 110], input: [-85, 0, 108], output: [85, 0, 108], pos: [110, -28, 170], drawer: [0, 60, 60] } as const;
export const ISO_POS_ANCHORS = { screen: [0, 0, 160], base: [0, 0, 0] } as const;
export const ISO_PRODUCT_ANCHORS = { box: { top: [0, 0, 126] }, bottle: { top: [0, 0, 180] }, can: { top: [0, 0, 120] } } as const;

export interface IsoShopProps extends CanvasProps {
  view?: 'exterior' | 'cutaway'; doorOpen?: number; wallColor?: string; awningColor?: string;
  shelfColor?: string; productColor?: string; scanProgress?: number; posActive?: boolean;
}
export const IsoShop: React.FC<IsoShopProps> = ({ view = 'exterior', doorOpen = 0, wallColor = '#D7D2BE', awningColor = '#537E79', shelfColor = '#8A9B98', productColor = '#CB8154', scanProgress = 0, posActive = false, ...props }) => {
  const angle = clamp(doorOpen) * Math.PI / 2;
  const doorEnd: CarPoint = [40 + Math.cos(angle) * 85, 153 - Math.sin(angle) * 85, 0];
  return <Canvas aria-label={view === 'exterior' ? 'Toko generik tampak luar' : 'Potongan toko dengan rak dan meja kasir'} {...props}>
    <Translate scale={0.65}>
    <Block x={-210} y={-160} w={420} d={330} h={6} color="#C9C8B6" />
    <Block x={-210} y={-160} z={6} w={420} d={8} h={240} color={wallColor} />
    <Block x={-210} y={-152} z={6} w={8} d={312} h={240} color={wallColor} />
    <Translate x={-45} y={-110} z={6} scale={0.9}><ShelfShape color={shelfColor} productColor={productColor} /></Translate>
    <Translate x={70} y={50} z={6} scale={0.55}><CounterShape color="#AE8D6C" productColor={productColor} scanProgress={scanProgress} active={posActive} /></Translate>
    {view === 'exterior' ? <g data-part="storefront">
      <Block x={202} y={-152} z={6} w={8} d={312} h={240} color={wallColor} />
      <Block x={-210} y={145} z={6} w={242} d={10} h={190} color={wallColor} />
      <polygon points={points([[-190, 156, 35], [10, 156, 35], [10, 156, 170], [-190, 156, 170]])} fill="#88B3BA" opacity={0.85} stroke={ink} strokeWidth={3} />
      <polyline points={points([[-90, 156, 35], [-90, 156, 170]])} stroke={ink} strokeWidth={4} />
      <Block x={128} y={145} z={6} w={82} d={10} h={190} color={wallColor} />
      <polygon data-part="door" points={points([[40, 153, 6], [doorEnd[0], doorEnd[1], 6], [doorEnd[0], doorEnd[1], 190], [40, 153, 190]])} fill="#9BC0C4" fillOpacity={0.7} stroke={ink} strokeWidth={4} />
      <polyline data-part="door-handle" points={points([[40 + Math.cos(angle) * 72, 154 - Math.sin(angle) * 72, 83], [40 + Math.cos(angle) * 72, 154 - Math.sin(angle) * 72, 110]])} stroke={ink} strokeWidth={4} />
      <Block x={-210} y={145} z={196} w={420} d={10} h={50} color={wallColor} />
      <Block x={-160} y={156} z={209} w={320} d={3} h={24} color={awningColor} />
      <Block x={-220} y={-170} z={246} w={440} d={345} h={8} color="#72847F" />
      {Array.from({ length: 10 }, (_, i) => <polygon key={i} points={points([[-220 + i * 44, 150, 204], [-176 + i * 44, 150, 204], [-176 + i * 44, 215, 187], [-220 + i * 44, 215, 187]])} fill={i % 2 ? '#F4ECD9' : awningColor} stroke={ink} strokeWidth={0.5} />)}
    </g> : null}
    </Translate>
  </Canvas>;
};
