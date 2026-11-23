/**
 * Generates src/head-geo.json: a head sculpted from a fine sphere, then
 * decimated to a low-poly mesh. Run with `npm run head` after changing the shape.
 */
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

/** Deterministic PRNG so the head looks the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bump = (dx: number, dy: number, sx: number, sy: number) =>
  Math.exp(-((dx * dx) / sx + (dy * dy) / sy));

/** Sculpts a unit sphere into a stylised human head facing +Z. */
export function sculptHead(): THREE.BufferGeometry {
  // Sculpt finely so the features resolve, then decimate for the low-poly look.
  const base = new THREE.IcosahedronGeometry(1, 18);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geo = mergeVertices(base, 1e-4);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const rand = rng(7);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;

    // Skull: narrower than tall, deeper at the back.
    x *= 0.7;
    y *= 1.0;
    z *= z < 0 ? 0.98 : 0.8;

    // Lower half tapers hard into jaw and chin; cheeks hollow under the bones.
    if (y < 0.05) {
      const t = Math.min(1, (0.05 - y) / 1.05);
      x *= 1 - 0.5 * Math.pow(t, 1.25);
      if (z < 0) z *= 1 - 0.55 * t; // back of the neck/jaw pulls in
      if (z > 0) z = z * (1 - 0.15 * t) + 0.1 * t;
    }
    // Temples pinch in slightly.
    x *= 1 - 0.06 * Math.exp(-((y - 0.35) ** 2) / 0.02) * (z > 0 ? 1 : 0.3);

    if (z > 0) {
      const front = Math.min(1, z / 0.5);
      // Flat face plane.
      if (z > 0.5) z = 0.5 + (z - 0.5) * 0.45;
      // Brow ridge.
      z += 0.09 * bump(x, y - 0.3, 0.09, 0.004) * front;
      // Deep eye sockets.
      z -= 0.2 * (bump(x - 0.25, y - 0.14, 0.01, 0.006) + bump(x + 0.25, y - 0.14, 0.01, 0.006)) * front;
      // Nose: a ridge down the middle ending in a tip.
      z += 0.14 * bump(x, y - 0.05, 0.003, 0.03) * front;
      z += 0.22 * bump(x, y + 0.12, 0.006, 0.006) * front;
      // Nostril wings, cheekbones.
      z += 0.05 * (bump(x - 0.07, y + 0.15, 0.003, 0.003) + bump(x + 0.07, y + 0.15, 0.003, 0.003)) * front;
      z += 0.07 * (bump(x - 0.36, y - 0.0, 0.01, 0.01) + bump(x + 0.36, y - 0.0, 0.01, 0.01)) * front;
      // Lips and the groove between them.
      z += 0.06 * bump(x, y + 0.33, 0.03, 0.002) * front;
      z -= 0.05 * bump(x, y + 0.39, 0.03, 0.0008) * front;
      z += 0.05 * bump(x, y + 0.45, 0.03, 0.002) * front;
      // Chin.
      z += 0.08 * bump(x, y + 0.7, 0.02, 0.01) * front;
    }

    pos.setXYZ(i, x, y, z);
  }
  const keep = 620;
  const low = new SimplifyModifier().modify(geo, Math.max(0, pos.count - keep));
  // Faceted, hand-modelled feel.
  const lp = low.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < lp.count; i++) {
    lp.setXYZ(i, lp.getX(i) + (rand() - 0.5) * 0.012, lp.getY(i) + (rand() - 0.5) * 0.012, lp.getZ(i) + (rand() - 0.5) * 0.012);
  }
  low.computeVertexNormals();
  return low;
}


const geo = sculptHead();
const pos = geo.getAttribute('position') as THREE.BufferAttribute;
const round = (n: number) => Math.round(n * 1e4) / 1e4;
const out = {
  position: Array.from(pos.array as Float32Array, round),
  index: geo.index ? Array.from(geo.index.array as ArrayLike<number>) : [...Array(pos.count).keys()],
};
writeFileSync(new URL('../src/head-geo.json', import.meta.url), JSON.stringify(out));
console.log(`head: ${pos.count} vertices, ${out.index.length / 3} faces`);
