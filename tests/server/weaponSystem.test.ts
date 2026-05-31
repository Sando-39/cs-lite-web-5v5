import { describe, expect, it } from "vitest";
import {
  applySpreadRecovery, canFireWeapon, completeReloadIfReady,
  createInitialWeaponInventory, getActiveWeaponState, startReload,
  switchWeapon, updateWeaponAfterAcceptedFire
} from "../../server/logic/weaponSystem";

describe("weaponSystem", () => {
  it("initializes AR-4 and R-47 weapon states", () => {
    const inventory = createInitialWeaponInventory();
    expect(inventory.activeWeaponId).toBe("ar4");
    expect(inventory.weapons.ar4.ammoInMag).toBe(30);
    expect(inventory.weapons.ar4.reserveAmmo).toBe(90);
    expect(inventory.weapons.r47.ammoInMag).toBe(30);
    expect(inventory.weapons.r47.reserveAmmo).toBe(90);
  });

  it("switches active weapon", () => {
    const result = switchWeapon(createInitialWeaponInventory(), "r47");
    expect(result.activeWeaponId).toBe("r47");
  });

  it("allows firing when ammo and cooldown are valid", () => {
    const inventory = createInitialWeaponInventory();
    const weapon = getActiveWeaponState(inventory);
    expect(canFireWeapon(weapon, "ar4", 1000)).toEqual({ allowed: true, reason: "fired" });
  });

  it("rejects firing during cooldown", () => {
    const inventory = createInitialWeaponInventory();
    inventory.weapons.ar4.nextFireAt = 2000;
    expect(canFireWeapon(inventory.weapons.ar4, "ar4", 1000)).toEqual({ allowed: false, reason: "cooldown" });
  });

  it("rejects firing with an empty mag", () => {
    const inventory = createInitialWeaponInventory();
    inventory.weapons.ar4.ammoInMag = 0;
    expect(canFireWeapon(inventory.weapons.ar4, "ar4", 1000).reason).toBe("empty_mag");
  });

  it("updates ammo, cooldown, and spread after accepted fire", () => {
    const inventory = createInitialWeaponInventory();
    const result = updateWeaponAfterAcceptedFire(inventory.weapons.ar4, "ar4", 1000);
    expect(result.ammoInMag).toBe(29);
    expect(result.nextFireAt).toBeGreaterThan(1000);
    expect(result.currentSpread).toBeGreaterThan(0);
  });

  it("starts reload when mag is not full and reserve ammo exists", () => {
    const inventory = createInitialWeaponInventory();
    inventory.weapons.ar4.ammoInMag = 12;
    const result = startReload(inventory.weapons.ar4, "ar4", 1000);
    expect(result.started).toBe(true);
    expect(result.weapon.isReloading).toBe(true);
    expect(result.weapon.reloadEndsAt).toBe(2900);
  });

  it("completes reload and consumes reserve ammo", () => {
    const inventory = createInitialWeaponInventory();
    inventory.weapons.ar4.ammoInMag = 12;
    const started = startReload(inventory.weapons.ar4, "ar4", 1000);
    const completed = completeReloadIfReady(started.weapon, "ar4", 2900);
    expect(completed.ammoInMag).toBe(30);
    expect(completed.reserveAmmo).toBe(72);
    expect(completed.isReloading).toBe(false);
  });

  it("recovers spread over time", () => {
    const inventory = createInitialWeaponInventory();
    inventory.weapons.r47.currentSpread = 0.05;
    const recovered = applySpreadRecovery(inventory.weapons.r47, "r47", 1);
    expect(recovered.currentSpread).toBeLessThan(0.05);
  });
});
