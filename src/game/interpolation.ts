export function lerpNumber(from: number, to: number, alpha: number): number {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return from + (to - from) * safeAlpha;
}

export function normalizeAngleRadians(angle: number): number {
  let result = angle;

  while (result > Math.PI) {
    result -= Math.PI * 2;
  }

  while (result < -Math.PI) {
    result += Math.PI * 2;
  }

  return result;
}

export function lerpRotationY(from: number, to: number, alpha: number): number {
  const delta = normalizeAngleRadians(to - from);
  return normalizeAngleRadians(from + delta * Math.max(0, Math.min(1, alpha)));
}
