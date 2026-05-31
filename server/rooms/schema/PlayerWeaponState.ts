import { Schema, type } from "@colyseus/schema";
import type { WeaponId } from "../../../shared/weapons.js";
import type { PlayerWeaponSnapshot } from "../../../shared/types.js";

export class PlayerWeaponState extends Schema {
  @type("string") weaponId: WeaponId = "ar4";
  @type("number") ammoInMag = 30;
  @type("number") reserveAmmo = 90;
  @type("boolean") isReloading = false;
  @type("number") reloadEndsAt = 0;
  @type("number") nextFireAt = 0;
  @type("number") currentSpread = 0;
  @type("number") recoilIndex = 0;

  applySnapshot(snapshot: PlayerWeaponSnapshot): void {
    this.weaponId = snapshot.weaponId;
    this.ammoInMag = snapshot.ammoInMag;
    this.reserveAmmo = snapshot.reserveAmmo;
    this.isReloading = snapshot.isReloading;
    this.reloadEndsAt = snapshot.reloadEndsAt;
    this.nextFireAt = snapshot.nextFireAt;
    this.currentSpread = snapshot.currentSpread;
    this.recoilIndex = snapshot.recoilIndex;
  }

  toSnapshot(): PlayerWeaponSnapshot {
    return {
      weaponId: this.weaponId, ammoInMag: this.ammoInMag, reserveAmmo: this.reserveAmmo,
      isReloading: this.isReloading, reloadEndsAt: this.reloadEndsAt,
      nextFireAt: this.nextFireAt, currentSpread: this.currentSpread, recoilIndex: this.recoilIndex
    };
  }
}
