# PRVC

Landing page for PRVC, a privacy layer for Solana, with a real-time 3D wireframe head in the hero.

- **Stack:** Vite + TypeScript + three.js. No framework, no backend.
- **3D head:** sculpted procedurally from a sphere and decimated to a low-poly mesh (`scripts/build-head.ts` → `src/head-geo.json`). Rendered as glowing wireframe + vertex nodes + drifting shards with bloom, easing toward the pointer. Respects `prefers-reduced-motion`; pauses when off-screen; the page still works without WebGL.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run head      # regenerate the head mesh after editing its shape
```

## Deploy (Vercel)

Import the repo; Vercel detects Vite. Build command `npm run build`, output `dist`.
