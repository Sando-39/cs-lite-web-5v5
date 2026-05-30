export type PlayerColor = "blue" | "orange";

export type MoveMessage = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
};

export type ServerPlayerRecord = {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
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
  color: PlayerColor;
};
