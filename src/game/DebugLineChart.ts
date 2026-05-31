export type LineChartInput = { label: string; color: string; values: number[]; unit: string; maxHint?: number };

export class DebugLineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement, width = 220, height = 60) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width; this.canvas.height = height;
    this.canvas.className = "debug-line-chart";
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create debug chart context");
    this.ctx = ctx;
    parent.appendChild(this.canvas);
  }

  render(input: LineChartInput): void {
    const { ctx, canvas: { width, height } } = this;
    const { values } = input;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.22)"; ctx.lineWidth = 1;
    for (let y = 15; y < height; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.fillStyle = "#cbd5e1"; ctx.font = "10px monospace"; ctx.fillText(input.label, 6, 12);
    if (values.length < 2) return;
    const maxV = Math.max(input.maxHint ?? 0, ...values, 1);
    ctx.strokeStyle = input.color; ctx.lineWidth = 2; ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v / maxV) * (height - 18)) - 4;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    const latest = values[values.length - 1];
    ctx.fillStyle = "#f8fafc"; ctx.fillText(`${latest.toFixed(1)}${input.unit}`, width - 70, 12);
  }

  dispose(): void { this.canvas.remove(); }
}
