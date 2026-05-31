# CS-Lite Web v0.1

A browser-based multiplayer 3D skeleton.

## v0.1 Scope

- Two real players
- Public room join by room code
- Simple Babylon.js test map
- WASD + mouse look
- Remote player visibility
- Colyseus state sync
- Render Free deployment

## Not Included in v0.1

- Shooting
- AI
- Rounds
- Scoring
- 5v5
- Database
- Accounts

## Local Development

Install dependencies:

```bash
npm install
```

Run server and client together:

```bash
npm run dev
```

Client:

```text
http://localhost:5173
```

Server:

```text
http://localhost:2567
```

Health check:

```text
http://localhost:2567/healthz
```

## Production Build

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:2567
```

## Test

```bash
npm test
```

## Render Free Deployment

This project is designed to deploy as one Render Free Web Service.

Use these settings if creating the service manually:

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /healthz
Plan: Free
```

The included `render.yaml` uses the same settings.

## Free Hosting Limitations

Render Free Web Services can sleep after inactivity and wake on a later HTTP request or new WebSocket connection. v0.1 accepts this limitation. Existing in-memory rooms are lost when the service restarts or sleeps.

## v0.1 Manual QA Checklist

```markdown
- [ ] Local dev server starts
- [ ] Local Vite client starts
- [ ] Production build succeeds
- [ ] Production server starts
- [ ] `/healthz` returns `{ "ok": true }`
- [ ] User A can create a room
- [ ] Room code is visible in the HUD
- [ ] User B can join with the room code
- [ ] Third user is rejected
- [ ] Two users enter the same 3D scene
- [ ] User A can move with WASD
- [ ] User B can move with WASD
- [ ] User A can mouse-look after clicking the canvas
- [ ] User B can mouse-look after clicking the canvas
- [ ] User A sees User B's model
- [ ] User B sees User A's model
- [ ] User A sees User B movement
- [ ] User B sees User A movement
- [ ] Closing one tab removes the remote model in the other tab
- [ ] Stopping the server shows a disconnected state instead of a blank screen
```

## Public v0.1 Test URL

```text
https://cs-lite-web-5v5.onrender.com
```

Use this URL to create a room and invite one friend with the room code.
