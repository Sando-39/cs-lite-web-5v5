import type { WeaponId } from "../../shared/weapons";

export class AudioEventThrottle {
  private lastPlayedAt = new Map<string, number>();
  canPlay(key: string, now: number, minIntervalMs: number): boolean {
    const last = this.lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY;
    if (now - last < minIntervalMs) return false;
    this.lastPlayedAt.set(key, now); return true;
  }
}

export class GameAudio {
  private context: AudioContext | null = null;
  private throttle = new AudioEventThrottle();

  unlock(): void { if (!this.context) this.context = new AudioContext(); if (this.context.state === "suspended") void this.context.resume(); }

  playFire(weaponId: WeaponId): void { this.playTone(weaponId === "ar4" ? 180 : 130, 0.045, 0.12); }
  playEmpty(): void {
    if (!this.throttle.canPlay("empty", performance.now(), 150)) return;
    this.playTone(800, 0.025, 0.05);
  }
  playReload(): void { this.playTone(320, 0.12, 0.08); }
  playHit(): void {
    if (!this.throttle.canPlay("hit", performance.now(), 80)) return;
    this.playTone(520, 0.04, 0.08);
  }
  playDamage(): void {
    if (!this.throttle.canPlay("damage", performance.now(), 150)) return;
    this.playTone(90, 0.1, 0.12);
  }

  private playTone(frequency: number, durationSeconds: number, gainValue: number): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency; oscillator.type = "square"; gain.gain.value = gainValue;
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(); oscillator.stop(this.context.currentTime + durationSeconds);
  }
}
