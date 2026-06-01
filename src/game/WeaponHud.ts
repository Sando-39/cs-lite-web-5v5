import { WEAPONS, type WeaponId } from "../../shared/weapons";
import type { PlayerWeaponSnapshot } from "../../shared/types";
import { HudUpdateGate } from "./HudUpdateGate";

export class WeaponHud {
  private root: HTMLElement;
  private element: HTMLDivElement;
  private gate = new HudUpdateGate<string>(250, (a, b) => a === b);
  private updateCounter = 0;
  private lastCounterResetAt = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.element = document.createElement("div");
    this.element.className = "weapon-hud";
    this.root.appendChild(this.element);
  }

  render(activeWeaponId: WeaponId, weapons: PlayerWeaponSnapshot[], playerHp: number | null): void {
    const weapon = weapons.find(w => w.weaponId === activeWeaponId);
    const config = WEAPONS[activeWeaponId];
    const html = `<div class="weapon-name">${config.name}</div><div class="weapon-ammo">${weapon?.ammoInMag ?? "-"} / ${weapon?.reserveAmmo ?? "-"}</div><div class="weapon-status">${weapon?.isReloading ? "Reloading..." : ""}</div><div class="player-hp">HP: ${playerHp ?? "-"}</div>`;
    const now = performance.now();
    if (this.gate.shouldUpdate(html, now)) {
      this.element.innerHTML = html;
      if (now - this.lastCounterResetAt >= 1000) { this.updateCounter = 0; this.lastCounterResetAt = now; }
      this.updateCounter++;
    }
  }

  getDebugStats() { return { rendersPerSecond: this.updateCounter }; }

  dispose(): void { this.element.remove(); }
}
