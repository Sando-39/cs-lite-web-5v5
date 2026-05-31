export type WeaponId = "ar4" | "r47";

export type WeaponConfig = {
  id: WeaponId;
  name: string;
  damage: number;
  rpm: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadMs: number;
  range: number;
  baseSpread: number;
  maxSpread: number;
  spreadPerShot: number;
  spreadRecoveryPerSecond: number;
  movingSpreadMultiplier: number;
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilRecoveryPerSecond: number;
  muzzleFlashScale: number;
};

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  ar4: {
    id: "ar4", name: "AR-4", damage: 24, rpm: 750, magazineSize: 30,
    reserveAmmo: 90, reloadMs: 1900, range: 70,
    baseSpread: 0.004, maxSpread: 0.035, spreadPerShot: 0.003, spreadRecoveryPerSecond: 0.035,
    movingSpreadMultiplier: 1.6, verticalRecoil: 0.018, horizontalRecoil: 0.008,
    recoilRecoveryPerSecond: 0.07, muzzleFlashScale: 0.9
  },
  r47: {
    id: "r47", name: "R-47", damage: 34, rpm: 600, magazineSize: 30,
    reserveAmmo: 90, reloadMs: 2200, range: 75,
    baseSpread: 0.006, maxSpread: 0.055, spreadPerShot: 0.005, spreadRecoveryPerSecond: 0.024,
    movingSpreadMultiplier: 1.8, verticalRecoil: 0.028, horizontalRecoil: 0.014,
    recoilRecoveryPerSecond: 0.05, muzzleFlashScale: 1.2
  }
};

export const DEFAULT_WEAPON_ID: WeaponId = "ar4";

export function getWeaponConfig(weaponId: WeaponId): WeaponConfig {
  return WEAPONS[weaponId];
}

export function isWeaponId(value: unknown): value is WeaponId {
  return value === "ar4" || value === "r47";
}

export function getFireIntervalMs(weapon: WeaponConfig): number {
  return 60_000 / weapon.rpm;
}
