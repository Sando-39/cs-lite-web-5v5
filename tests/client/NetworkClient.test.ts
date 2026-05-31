import { describe, expect, it } from "vitest";
import type { FireResultMessage, WeaponFireResult } from "../../shared/types";
import {
  calculatePingEstimateMs,
  formatFireResultMessage,
  formatWeaponFireResultMessage,
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

  it("calculates ping from a pong client timestamp", () => {
    expect(calculatePingEstimateMs(1000, 1137)).toBe(137);
  });

  it("formats a hit fire result", () => {
    const result: FireResultMessage = {
      shooterSessionId: "a", hit: true, targetId: "target-1",
      damage: 25, targetHp: 75, targetKilled: false, reason: "hit"
    };
    expect(formatFireResultMessage(result, "a")).toBe("命中 +25，目标 HP: 75");
  });

  it("formats a kill fire result", () => {
    const result: FireResultMessage = {
      shooterSessionId: "a", hit: true, targetId: "target-1",
      damage: 25, targetHp: 0, targetKilled: true, reason: "hit"
    };
    expect(formatFireResultMessage(result, "a")).toBe("命中 +25，目标已死亡");
  });

  it("formats a miss fire result", () => {
    const result: FireResultMessage = {
      shooterSessionId: "a", hit: false, targetId: "target-1",
      damage: 0, targetHp: 100, targetKilled: false, reason: "miss"
    };
    expect(formatFireResultMessage(result, "a")).toBe("未命中");
  });

  it("ignores other players' fire result text for local feedback", () => {
    const result: FireResultMessage = {
      shooterSessionId: "b", hit: true, targetId: "target-1",
      damage: 25, targetHp: 75, targetKilled: false, reason: "hit"
    };
    expect(formatFireResultMessage(result, "a")).toBeNull();
  });

  it("formats local weapon hit result", () => {
    const result: WeaponFireResult = { shooterSessionId: "a", weaponId: "ar4", accepted: true, reason: "fired", ammoInMag: 29, reserveAmmo: 90, hit: true, targetType: "ai", targetId: "ai-1", damage: 24, targetHp: 76, targetKilled: false };
    expect(formatWeaponFireResultMessage(result, "a")).toBe("AR-4 命中 +24，目标 HP: 76");
  });

  it("formats empty mag result", () => {
    const result: WeaponFireResult = { shooterSessionId: "a", weaponId: "ar4", accepted: false, reason: "empty_mag", ammoInMag: 0, reserveAmmo: 90, hit: false, targetType: null, targetId: null, damage: 0, targetHp: null, targetKilled: false };
    expect(formatWeaponFireResultMessage(result, "a")).toBe("弹匣为空，按 R 换弹");
  });
});
