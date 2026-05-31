import { CAMERA_HEIGHT } from "./constants.js";

export type AiStateKind = "patrol" | "attack" | "dead" | "respawning";
export type AiWaypoint = { x: number; z: number };

export type AiEnemyConfig = {
  id: string; name: string; spawn: AiWaypoint; rotationY: number; waypoints: readonly AiWaypoint[];
  faction: "enemy";
  damageable: true;
};

export const AI_ENEMIES: readonly AiEnemyConfig[] = [
  { id: "ai-1", name: "Patrol One", spawn: { x: -10, z: -12 }, rotationY: 0,
    waypoints: [{ x: -10, z: -12 }, { x: -4, z: -14 }, { x: -2, z: -8 }],
    faction: "enemy" as const, damageable: true as const },
  { id: "ai-2", name: "Patrol Two", spawn: { x: 10, z: -12 }, rotationY: Math.PI,
    waypoints: [{ x: 10, z: -12 }, { x: 4, z: -14 }, { x: 2, z: -8 }],
    faction: "enemy" as const, damageable: true as const },
  { id: "ai-3", name: "Patrol Three", spawn: { x: 0, z: 12 }, rotationY: Math.PI,
    waypoints: [{ x: 0, z: 12 }, { x: -6, z: 8 }, { x: 6, z: 8 }],
    faction: "enemy" as const, damageable: true as const }
];

export function getAiSpawnY(): number { return CAMERA_HEIGHT; }

export function validateAiEnemies(): void {
  const ids = new Set<string>();
  for (const ai of AI_ENEMIES) {
    if (ids.has(ai.id)) throw new Error(`Duplicate AI id: ${ai.id}`);
    ids.add(ai.id);
    if (ai.waypoints.length < 2) throw new Error(`AI requires at least two waypoints: ${ai.id}`);
  }
}
