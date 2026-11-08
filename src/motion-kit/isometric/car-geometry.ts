export type CarPoint = readonly [x: number, y: number, z: number];

const COS_30 = Math.sqrt(3) / 2;

/** Ground axes have equal scale at ±30°; z points vertically up. */
export function projectCarPoint([x, y, z]: CarPoint): { x: number; y: number } {
  return { x: 380 + (x - y) * COS_30, y: 300 + (x + y) / 2 - z };
}

export function carPoints(vertices: readonly CarPoint[]): string {
  return vertices.map((vertex) => {
    const p = projectCarPoint(vertex);
    return `${p.x},${p.y}`;
  }).join(' ');
}
