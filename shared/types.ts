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
