import { WEAPONS, type WeaponId } from "../../shared/weapons";
import type { PlayerWeaponSnapshot } from "../../shared/types";

export class ReloadProgress {
  private element: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "reload-progress";
    root.appendChild(this.element);
  }

  render(weaponId: WeaponId, weapons: PlayerWeaponSnapshot[], now: number): void {
    const weapon = weapons.find(w => w.weaponId === weaponId);
    if (!weapon?.isReloading) { this.element.classList.remove("visible"); return; }
    const config = WEAPONS[weaponId];
    const remaining = Math.max(0, weapon.reloadEndsAt - now);
    const progress = Math.max(0, Math.min(1, 1 - remaining / config.reloadMs));
    const percent = Math.round(progress * 100);
    this.element.classList.add("visible");
    this.element.innerHTML = `<div class="reload-title">Reloading ${config.name}</div><div class="reload-bar"><div class="reload-fill" style="width:${percent}%"></div></div><div class="reload-percent">${percent}%</div>`;
  }

  dispose(): void { this.element.remove(); }
}
