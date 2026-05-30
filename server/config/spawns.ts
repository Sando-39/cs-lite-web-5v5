import { CAMERA_HEIGHT } from "../../shared/constants";
import type { PlayerColor } from "../../shared/types";

export type SpawnPoint = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  color: PlayerColor;
};

export const SPAWN_POINTS: readonly [SpawnPoint, SpawnPoint] = [
  {
    x: -4,
    y: CAMERA_HEIGHT,
    z: 0,
    rotationY: Math.PI / 2,
    color: "blue"
  },
  {
    x: 4,
    y: CAMERA_HEIGHT,
    z: 0,
    rotationY: -Math.PI / 2,
    color: "orange"
  }
];
