import type { WeaponId } from "../../shared/weapons.js";
import { DEFAULT_WEAPON_ID, getFireIntervalMs, getWeaponConfig, WEAPONS } from "../../shared/weapons.js";
import type { PlayerWeaponSnapshot, WeaponFireResultReason } from "../../shared/types.js";

export type WeaponInventory = { activeWeaponId: WeaponId; weapons: Record<WeaponId, PlayerWeaponSnapshot> };
export type CanFireResult = { allowed: boolean; reason: WeaponFireResultReason };
export type ReloadStartResult = { started: boolean; reason: "started" | "full_mag" | "no_reserve" | "already_reloading"; weapon: PlayerWeaponSnapshot };

export function createInitialWeaponInventory(): WeaponInventory {
  return { activeWeaponId: DEFAULT_WEAPON_ID, weapons: { ar4: createInitialWeaponState("ar4"), r47: createInitialWeaponState("r47") } };
}

export function createInitialWeaponState(weaponId: WeaponId): PlayerWeaponSnapshot {
  const config = getWeaponConfig(weaponId);
  return { weaponId, ammoInMag: config.magazineSize, reserveAmmo: config.reserveAmmo, isReloading: false, reloadEndsAt: 0, nextFireAt: 0, currentSpread: config.baseSpread, recoilIndex: 0 };
}

export function getActiveWeaponState(inventory: WeaponInventory): PlayerWeaponSnapshot {
  return inventory.weapons[inventory.activeWeaponId];
}

export function switchWeapon(inventory: WeaponInventory, weaponId: WeaponId): WeaponInventory {
  const previous = inventory.weapons[inventory.activeWeaponId];
  return { activeWeaponId: weaponId, weapons: { ...inventory.weapons, [inventory.activeWeaponId]: { ...previous, isReloading: false, reloadEndsAt: 0 } } };
}

export function canFireWeapon(weapon: PlayerWeaponSnapshot, weaponId: WeaponId, now: number): CanFireResult {
  if (weapon.weaponId !== weaponId) return { allowed: false, reason: "invalid_weapon" };
  if (weapon.isReloading) return { allowed: false, reason: "reloading" };
  if (weapon.ammoInMag <= 0) return { allowed: false, reason: "empty_mag" };
  if (now < weapon.nextFireAt) return { allowed: false, reason: "cooldown" };
  return { allowed: true, reason: "fired" };
}

export function updateWeaponAfterAcceptedFire(weapon: PlayerWeaponSnapshot, weaponId: WeaponId, now: number): PlayerWeaponSnapshot {
  const config = getWeaponConfig(weaponId);
  const fireInterval = getFireIntervalMs(config);
  return { ...weapon, ammoInMag: Math.max(0, weapon.ammoInMag - 1), nextFireAt: now + fireInterval, currentSpread: Math.min(config.maxSpread, weapon.currentSpread + config.spreadPerShot), recoilIndex: weapon.recoilIndex + 1 };
}

export function startReload(weapon: PlayerWeaponSnapshot, weaponId: WeaponId, now: number): ReloadStartResult {
  const config = WEAPONS[weaponId];
  if (weapon.isReloading) return { started: false, reason: "already_reloading", weapon };
  if (weapon.ammoInMag >= config.magazineSize) return { started: false, reason: "full_mag", weapon };
  if (weapon.reserveAmmo <= 0) return { started: false, reason: "no_reserve", weapon };
  return { started: true, reason: "started", weapon: { ...weapon, isReloading: true, reloadEndsAt: now + config.reloadMs } };
}

export function completeReloadIfReady(weapon: PlayerWeaponSnapshot, weaponId: WeaponId, now: number): PlayerWeaponSnapshot {
  if (!weapon.isReloading || now < weapon.reloadEndsAt) return weapon;
  const config = getWeaponConfig(weaponId);
  const needed = config.magazineSize - weapon.ammoInMag;
  const loaded = Math.min(needed, weapon.reserveAmmo);
  return { ...weapon, ammoInMag: weapon.ammoInMag + loaded, reserveAmmo: weapon.reserveAmmo - loaded, isReloading: false, reloadEndsAt: 0 };
}

export function applySpreadRecovery(weapon: PlayerWeaponSnapshot, weaponId: WeaponId, deltaSeconds: number): PlayerWeaponSnapshot {
  const config = getWeaponConfig(weaponId);
  return { ...weapon, currentSpread: Math.max(config.baseSpread, weapon.currentSpread - config.spreadRecoveryPerSecond * deltaSeconds) };
}
