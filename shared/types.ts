import type { WeaponId } from "./weapons.js";

export type PlayerColor = "blue" | "orange";

export type MoveMessage = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  pitch: number;
};

export type FireMessage = {
  clientTime: number;
};

export type FireResultReason =
  | "hit"
  | "miss"
  | "target_dead"
  | "invalid_player";

export type FireResultMessage = {
  shooterSessionId: string;
  hit: boolean;
  targetId: string | null;
  damage: number;
  targetHp: number | null;
  targetKilled: boolean;
  reason: FireResultReason;
};

export type ServerPlayerRecord = {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  pitch: number;
  color: PlayerColor;
  lastMoveAt: number;
  hp: number;
  maxHp: number;
  lastDamagedAt: number;
  activeWeaponId: WeaponId;
};

export type ClientPlayerSnapshot = {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  pitch: number;
  color: PlayerColor;
  hp: number;
  maxHp: number;
  lastDamagedAt: number;
  activeWeaponId: WeaponId;
};

export type TargetSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnAt: number;
};

export type PlayerWeaponSnapshot = {
  weaponId: WeaponId;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadEndsAt: number;
  nextFireAt: number;
  currentSpread: number;
  recoilIndex: number;
};

export type WeaponFireMessage = { weaponId: WeaponId; clientTime: number };
export type ReloadWeaponMessage = { weaponId: WeaponId; clientTime: number };
export type SwitchWeaponMessage = { weaponId: WeaponId; clientTime: number };

export type WeaponFireResultReason = "fired" | "cooldown" | "empty_mag" | "reloading" | "invalid_weapon";

export type WeaponFireResult = {
  shooterSessionId: string; weaponId: WeaponId; accepted: boolean;
  reason: WeaponFireResultReason; ammoInMag: number; reserveAmmo: number;
  hit: boolean; targetType: "ai" | "static_target" | null;
  targetId: string | null; damage: number; targetHp: number | null; targetKilled: boolean;
  tracerStart?: { x: number; y: number; z: number } | null;
  tracerEnd?: { x: number; y: number; z: number } | null;
};

export type ReloadResultReason = "started" | "full_mag" | "no_reserve" | "already_reloading" | "invalid_weapon";

export type ReloadResult = {
  sessionId: string; weaponId: WeaponId; started: boolean;
  reason: ReloadResultReason; reloadEndsAt: number;
};

export type PlayerDamagedMessage = { sessionId: string; damage: number; hp: number; source: "ai"; sourceId: string };
export type AiEventMessage = { aiId: string; type: "damaged" | "killed" | "respawned" | "fired" };

export type ServerDebugStatsMessage = {
  serverTime: number;
  tickMs: number;
  aiUpdateMs: number;
  fireProcessingMs: number;
  playerCount: number;
  aiCount: number;
  aliveAiCount: number;
  fireAcceptedPerSecond: number;
  fireRejectedPerSecond: number;
  statePatchHz: number | null;
};
