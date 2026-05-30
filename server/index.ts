import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "../shared/constants.js";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);
const app = express();
const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define(ROOM_NAME, GameRoom);

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

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`CS-Lite server listening on port ${port}`);
});
