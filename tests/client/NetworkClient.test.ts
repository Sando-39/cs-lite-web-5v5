import { describe, expect, it } from "vitest";
import {
  getColyseusEndpoint,
  mapJoinErrorToMessage
} from "../../src/network/NetworkClient";

describe("NetworkClient helpers", () => {
  it("uses localhost server during local Vite development", () => {
    expect(
      getColyseusEndpoint({
        isDev: true,
        protocol: "http:",
        host: "localhost:5173"
      })
    ).toBe("ws://localhost:2567");
  });

  it("uses secure websocket on https production origin", () => {
    expect(
      getColyseusEndpoint({
        isDev: false,
        protocol: "https:",
        host: "example.onrender.com"
      })
    ).toBe("wss://example.onrender.com");
  });

  it("uses plain websocket on http production origin", () => {
    expect(
      getColyseusEndpoint({
        isDev: false,
        protocol: "http:",
        host: "localhost:2567"
      })
    ).toBe("ws://localhost:2567");
  });

  it("maps full room errors to the approved Chinese message", () => {
    expect(mapJoinErrorToMessage(new Error("ROOM_FULL"))).toBe(
      "房间已满，当前版本仅支持 2 名玩家"
    );
  });

  it("maps unknown join errors to a generic connection message", () => {
    expect(mapJoinErrorToMessage(new Error("anything else"))).toBe(
      "连接失败，请稍后重试"
    );
  });
});
