# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # run all tests (vitest)
npm test -- <file>        # run a single test file
npm run dev               # dev server (Vite :5173 + Colyseus :2567)
npm run build             # production build (client Vite + server tsc)
npm start                 # production server (port from PORT env, default 2567)
```

## Architecture

Browser FPS training field. **Server-authoritative**: client sends input intent; server owns hit detection, HP, ammo, reload, AI behavior. Client owns visuals and local input feel.

### Dual TypeScript setup

- **Client**: `tsconfig.json` — `ESNext` / `Bundler` module resolution. No `.js` extensions in imports.
- **Server**: `tsconfig.server.json` — `NodeNext` / `NodeNext`. **Every relative import in `server/` and `shared/` MUST end with `.js`** (e.g. `import { x } from "./foo.js"`). This is the #1 build error source when adding new server files.

### Shared layer (`shared/`)

Pure data used by both sides. No Babylon.js or Colyseus schema imports here. Contains all game constants, types, weapon configs, AI configs, collision primitives, and map geometry.

### Server (`server/`)

- `GameRoom.ts` — single biggest file. Central integration point: Colyseus room lifecycle, message handlers (`weaponFire`, `reload`, `switchWeapon`, `move`, `ping`), simulation tick (20Hz), AI update (15Hz within tick), player regen, reload completion, debug stats broadcast. Uses `sendTargeted()` for shooter-only messages and `broadcastCounted()` for all-player events.
- All game logic is pure functions in `server/logic/` — testable without Colyseus.
- Schemas in `server/rooms/schema/` use `@colyseus/schema` decorators. `MapSchema<>` for dynamic collections (players, weapons, aiEnemies).
- `server/index.ts` — Express + Colyseus entry. Serves `dist/client` in production. Sets `Cache-Control: no-cache` on HTML, immutable long cache on hashed assets.

### Client (`src/`)

- `ClientGame.ts` — second biggest file. Main loop: input update → camera sync → fire throttle → network send → remote render → HUD update → debug stats. Camera pitch formula: `realAimPitch + visualRecoilPunch - damagePunch`. Never modify real aim pitch from recoil/damage systems.
- `InputController.ts` — WASD movement with `resolveMapMovement()` collision, mouse look via Pointer Lock, full-auto hold via `isFireHeld`, weapon keys (R/1/2). Accepts `WeaponInputCallbacks`.
- `NetworkClient.ts` — wraps Colyseus SDK. `getColyseusEndpoint()` auto-selects ws/wss. Exposes event setters (`setWeaponFireResultHandler`, etc.) for ClientGame to wire. Much of the feedback flow is driven by server message callbacks, not imperative calls.
- Visual systems use object pools (TracerView) or constructor-created reusable objects (WeaponView muzzle flash). HudUpdateGate throttles DOM writes.
- `DebugHud.ts` — F3 toggles expanded panel with 4 canvas line charts and 40+ text metrics. Renders at 5Hz max.

### Data flow (fire weapon)

```
hold left mouse (60fps) → ClientGame.trySendHeldFire() (RPM-throttled)
→ NetworkClient.sendWeaponFire() → WebSocket
→ GameRoom.handleWeaponFire() → canFireWeapon() → updateWeaponAfterAcceptedFire()
→ createShotRay() → intersectRayWithAiEnemy() → AI HP update
→ sendTargeted(shooter, "weaponFireResult") → ClientGame handler
→ playAcceptedFire (muzzle flash + recoil + tracer + audio)
```

### Key constants (all in `shared/constants.ts`)

Player: 100 HP, regen 10/s after 3s delay, move 6/s, server clamp 9/s, pitch ±1.35
AI: 100 HP, 12 dmg/0.9s, detection 18u/FOV 120°, move 2.2/s, respawn 5s
Weapons: AR-4 (750RPM/24dmg), R-47 (600RPM/34dmg), both 30/90 ammo
Network: move send 20Hz, sim 20Hz, AI update 15Hz
Map: 48×48 units, camera height 1.7

### Deprecated but kept files

`shared/staticTargets.ts`, `server/rooms/schema/TargetState.ts`, `src/game/TargetView.ts` — v0.3 static target system, no longer initialized in GameRoom or rendered in ClientGame. Tests referencing `target-1` have been removed or updated to expect 0 targets.
