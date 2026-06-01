import express from "express";
import fs from "node:fs";
import path from "node:path";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "../shared/constants.js";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

const transport = new WebSocketTransport();

const gameServer = new Server({
  transport,
  // Register custom routes via the Server's express callback.
  // This ensures bindRouterToTransport integrates the Express app
  // as the fallback handler after Colyseus matchmaking routes.
  express(app) {
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
      app.use(
        express.static(clientDistPath, {
          setHeaders(res, filePath) {
            if (filePath.endsWith("index.html")) {
              res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            } else {
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            }
          }
        })
      );

      app.get("/{*splat}", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
  }
});

gameServer.define(ROOM_NAME, GameRoom);

gameServer.listen(port, "0.0.0.0", undefined, () => {
  console.log(`CS-Lite server listening on port ${port}`);
});
