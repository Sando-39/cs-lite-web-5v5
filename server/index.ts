import express from "express";
import fs from "node:fs";
import path from "node:path";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "../shared/constants.js";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

// Let Colyseus create and own the HTTP server so it handles matchmaking routes
const transport = new WebSocketTransport();
const gameServer = new Server({ transport });

gameServer.define(ROOM_NAME, GameRoom);

// Mount our routes on the Colyseus transport's internal Express app
const app = transport.getExpressApp();

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "cs-lite-web-5v5",
    room: ROOM_NAME
  });
});

const clientDistPath = path.resolve(process.cwd(), "dist/client");
const clientIndexPath = path.join(clientDistPath, "index.html");

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get("/{*splat}", (_req, res) => {
    res.sendFile(clientIndexPath);
  });
} else {
  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      message:
        "CS-Lite server is running. Run npm run dev:client for the Vite client during development."
    });
  });
}

transport.listen(port, "0.0.0.0", undefined, () => {
  console.log(`CS-Lite server listening on port ${port}`);
});
