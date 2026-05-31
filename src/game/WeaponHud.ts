import { WEAPONS, type WeaponId } from "../../shared/weapons";
import type { PlayerWeaponSnapshot } from "../../shared/types";

export class WeaponHud {
  private root: HTMLElement;
  private element: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.element = document.createElement("div");
    this.element.className = "weapon-hud";
    this.root.appendChild(this.element);
  }

  render(activeWeaponId: WeaponId, weapons: PlayerWeaponSnapshot[], playerHp: number | null): void {
    const weapon = weapons.find(c => c.weaponId === activeWeaponId);
    const config = WEAPONS[activeWeaponId];
    this.element.innerHTML = `<div class="weapon-name">${config.name}</div><div class="weapon-ammo">${weapon?.ammoInMag ?? "-"} / ${weapon?.reserveAmmo ?? "-"}</div><div class="weapon-status">${weapon?.isReloading ? "Reloading..." : ""}</div><div class="player-hp">HP: ${playerHp ?? "-"}</div>`;
  }

  dispose(): void { this.element.remove(); }
}
