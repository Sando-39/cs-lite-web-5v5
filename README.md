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
