import type { WeaponId } from "../../shared/weapons";

export class GameAudio {
  private context: AudioContext | null = null;

  unlock(): void { if (!this.context) this.context = new AudioContext(); if (this.context.state === "suspended") void this.context.resume(); }

  playFire(weaponId: WeaponId): void { this.playTone(weaponId === "ar4" ? 180 : 130, 0.045, 0.12); }
  playEmpty(): void { this.playTone(800, 0.025, 0.05); }
  playReload(): void { this.playTone(320, 0.12, 0.08); }
  playHit(): void { this.playTone(520, 0.04, 0.08); }
  playDamage(): void { this.playTone(90, 0.1, 0.12); }

  private playTone(frequency: number, durationSeconds: number, gainValue: number): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency; oscillator.type = "square"; gain.gain.value = gainValue;
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(); oscillator.stop(this.context.currentTime + durationSeconds);
  }
}
