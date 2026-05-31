import {
  TARGET_MAX_HP,
  TARGET_RESPAWN_DELAY_MS
} from "./constants.js";

export type StaticTargetConfig = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  maxHp: number;
  respawnDelayMs: number;
};

export const STATIC_TARGETS: readonly StaticTargetConfig[] = [
  {
    id: "target-1",
    name: "Training Dummy",
    x: 0,
    y: 0,
    z: -14,
    radius: 0.6,
    height: 1.8,
    maxHp: TARGET_MAX_HP,
    respawnDelayMs: TARGET_RESPAWN_DELAY_MS
  }
];

export function getStaticTargetConfig(targetId: string): StaticTargetConfig | null {
  return STATIC_TARGETS.find((target) => target.id === targetId) ?? null;
}

export function validateStaticTargets(): void {
  const ids = new Set<string>();

  for (const target of STATIC_TARGETS) {
    if (ids.has(target.id)) {
      throw new Error(`Duplicate static target id: ${target.id}`);
    }

    ids.add(target.id);

    if (target.radius <= 0 || target.height <= 0 || target.maxHp <= 0) {
      throw new Error(`Invalid static target dimensions or HP: ${target.id}`);
    }

    if (target.respawnDelayMs < 0) {
      throw new Error(`Invalid static target respawn delay: ${target.id}`);
    }
  }
}
