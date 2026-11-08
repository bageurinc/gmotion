import { describe, expect, it } from 'vitest';
import { blobMesh, blobSurfaceY, BlobLobe } from './iso-geometry';

const ball: BlobLobe[] = [{ at: [0, 0, 0], r: 0.8 }];

function signedVolume({ positions, indices }: ReturnType<typeof blobMesh>) {
  let volume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = [indices[index], indices[index + 1], indices[index + 2]].map((vertex) => [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return volume;
}

function extent(mesh: ReturnType<typeof blobMesh>, axis: number) {
  const values = Array.from(mesh.positions).filter((_, index) => index % 3 === axis);
  return [Math.min(...values), Math.max(...values)];
}

describe('blobMesh', () => {
  it('fills the requested size exactly, with its base on the floor', () => {
    const mesh = blobMesh(ball, [8, 4, 6], 24);
    expect(extent(mesh, 0)).toEqual([expect.closeTo(-4, 3), expect.closeTo(4, 3)]);
    expect(extent(mesh, 1)).toEqual([expect.closeTo(0, 3), expect.closeTo(4, 3)]);
    expect(extent(mesh, 2)).toEqual([expect.closeTo(-3, 3), expect.closeTo(3, 3)]);
  });

  it('faces outward, because the outline hull relies on winding', () => {
    expect(signedVolume(blobMesh(ball, [4, 4, 4], 24))).toBeGreaterThan(0);
  });

  it('comes close to a sphere volume', () => {
    expect(signedVolume(blobMesh(ball, [4, 4, 4], 40))).toBeCloseTo((4 / 3) * Math.PI * 8, -0.5);
  });

  it('is deterministic', () => {
    expect(blobMesh(ball, [4, 4, 4], 20).positions).toEqual(blobMesh(ball, [4, 4, 4], 20).positions);
  });

  it('tapers a limb toward its end', () => {
    const limb: BlobLobe[] = [{ at: [-0.8, 0, 0], r: 0.5, to: [0.8, 0, 0], toR: 0.08 }];
    const mesh = blobMesh(limb, [8, 2, 2], 32);
    expect(blobSurfaceY(mesh, -2, 0, 0.3)).toBeGreaterThan(blobSurfaceY(mesh, 3.6, 0, 0.3));
  });

  it('gives each vertex shares that favor its nearest lobe and sum to one', () => {
    const mesh = blobMesh([{ at: [-0.6, 0, 0], r: 0.5 }, { at: [0.6, 0, 0], r: 0.5 }], [8, 4, 4], 24);
    for (let index = 0; index < mesh.positions.length / 3; index += 1) {
      const [left, right] = [mesh.weights[index * 2], mesh.weights[index * 2 + 1]];
      expect(left + right).toBeCloseTo(1);
      if (Math.abs(mesh.positions[index * 3]) > 1) expect(left > right).toBe(mesh.positions[index * 3] < 0);
    }
  });
});
