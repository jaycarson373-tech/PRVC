import * as THREE from 'three';
import headData from './head-geo.json';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * The PRVC hero: a low-poly wireframe head built procedurally (no model file),
 * with glowing vertex nodes, drifting shards and bloom. It eases toward the
 * pointer and idles with a slow sway.
 */

const CYAN = new THREE.Color('#5ee6ff');
const ICE = new THREE.Color('#d9fbff');
const BG = new THREE.Color('#06090c');

/** Deterministic PRNG so the scene looks the same on every load. */
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

/** Soft round sprite used for every glowing point. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(200,245,255,0.85)');
  grd.addColorStop(1, 'rgba(94,230,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface HeadScene {
  dispose(): void;
}

export function mountHead(container: HTMLElement): HeadScene {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 3.2, 5.6); // back edges fade into the dark
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.05, 4.3);

  const rig = new THREE.Group();
  scene.add(rig);
  const head = new THREE.Group();
  rig.add(head);

  // Wireframe edges.
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.Float32BufferAttribute(headData.position, 3));
  headGeo.setIndex(headData.index);
  headGeo.computeVertexNormals();
  const wire = new THREE.WireframeGeometry(headGeo);
  const lines = new THREE.LineSegments(
    wire,
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }),
  );
  head.add(lines);

  // A dark inner shell so back-facing edges read as "behind" the face.
  const shell = new THREE.Mesh(
    headGeo,
    new THREE.MeshBasicMaterial({ color: BG, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  );
  shell.scale.setScalar(0.992);
  shell.renderOrder = -1;
  head.add(shell);

  // Glowing vertex nodes; a random subset are bright "hubs" that pulse.
  const sprite = glowTexture();
  const vtx = headGeo.getAttribute('position') as THREE.BufferAttribute;
  const rand = rng(42);
  const hubIdx: number[] = [];
  for (let i = 0; i < vtx.count; i++) if (rand() < 0.035) hubIdx.push(i);

  const nodes = new THREE.Points(
    headGeo,
    new THREE.PointsMaterial({ color: CYAN, size: 0.026, map: sprite, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
  );
  head.add(nodes);

  const hubGeo = new THREE.BufferGeometry();
  const hubPos = new Float32Array(hubIdx.length * 3);
  hubIdx.forEach((vi, k) => hubPos.set([vtx.getX(vi), vtx.getY(vi), vtx.getZ(vi)], k * 3));
  hubGeo.setAttribute('position', new THREE.BufferAttribute(hubPos, 3));
  const hubMat = new THREE.PointsMaterial({ color: ICE, size: 0.11, map: sprite, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const hubs = new THREE.Points(hubGeo, hubMat);
  head.add(hubs);

  // Drifting triangular shards around the head.
  const shards: { mesh: THREE.LineLoop; spin: THREE.Vector3; drift: number; phase: number; base: THREE.Vector3 }[] = [];
  const shardMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 34; i++) {
    const s = 0.025 + rand() * 0.045;
    const tri = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, s, 0),
      new THREE.Vector3(-s * 0.87, -s * 0.5, 0),
      new THREE.Vector3(s * 0.87, -s * 0.5, 0),
    ]);
    const mesh = new THREE.LineLoop(tri, shardMat);
    const side = rand() < 0.5 ? -1 : 1;
    const base = new THREE.Vector3(side * (0.95 + rand() * 0.75), -0.9 + rand() * 1.5, -0.4 + rand() * 0.9);
    mesh.position.copy(base);
    mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    rig.add(mesh);
    shards.push({ mesh, base, spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8), drift: 0.04 + rand() * 0.08, phase: rand() * 6.28 });
  }

  // Post: bloom gives the neon glow.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Pointer easing.
  const target = new THREE.Vector2();
  const current = new THREE.Vector2();
  const onPointer = (e: PointerEvent) => {
    target.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    // Keep the whole head in frame on tall/narrow containers.
    camera.position.z = w / h < 0.8 ? 5.4 : 4.3;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(container);

  const clock = new THREE.Clock();
  let raf = 0;
  let intro = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    intro = Math.min(1, intro + dt * 0.6);
    const ease = 1 - Math.pow(1 - intro, 3);

    current.lerp(target, reduceMotion ? 1 : 0.045);
    const sway = reduceMotion ? 0 : Math.sin(t * 0.35) * 0.12;
    head.rotation.y = -0.5 + current.x * 0.55 + sway;
    head.rotation.x = current.y * 0.22 + (reduceMotion ? 0 : Math.sin(t * 0.27) * 0.03);
    head.position.y = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.03;
    head.scale.setScalar(0.92 + 0.08 * ease);

    (lines.material as THREE.LineBasicMaterial).opacity = 0.55 * ease;
    (nodes.material as THREE.PointsMaterial).opacity = 0.5 * ease;
    hubMat.opacity = (0.65 + 0.35 * Math.sin(t * 2.2)) * ease;
    hubMat.size = 0.1 + 0.025 * Math.sin(t * 2.2);

    for (const s of shards) {
      if (!reduceMotion) {
        s.mesh.rotation.x += s.spin.x * dt;
        s.mesh.rotation.y += s.spin.y * dt;
        s.mesh.rotation.z += s.spin.z * dt;
        s.mesh.position.y = s.base.y + Math.sin(t * s.drift * 6 + s.phase) * 0.06;
      }
    }
    shardMat.opacity = 0.55 * ease;
    rig.rotation.y = current.x * 0.12;

    composer.render();
  };
  tick();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      ro.disconnect();
      io.disconnect();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
