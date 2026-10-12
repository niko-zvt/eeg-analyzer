import { useEffect, useRef } from "react";

export interface SpectrumSeries {
  id: string;
  label: string;
  color: string;
  frequencies: number[];
  values: number[];
  ciLow?: number[];
  ciHigh?: number[];
  dashed?: boolean;
}

interface SpectrumChartProps {
  series: SpectrumSeries[];
  xLabel: string;
  yLabel: string;
  height?: number;
}

const PADDING = { top: 12, right: 12, bottom: 28, left: 52 };
const GRID_COLOR = "rgba(255,255,255,0.08)";
const AXIS_COLOR = "#888";
const BG = "#1a1a1a";
const CI_ALPHA = 0.3;

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return value.toExponential(1);
  if (Math.abs(value) >= 10) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SpectrumChart({
  series,
  xLabel,
  yLabel,
  height = 200,
}: SpectrumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || series.length === 0) return;

    const draw = () => {
      const w = container.clientWidth;
      const h = height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      const plotLeft = PADDING.left;
      const plotRight = w - PADDING.right;
      const plotTop = PADDING.top;
      const plotBottom = h - PADDING.bottom;
      const plotW = plotRight - plotLeft;
      const plotH = plotBottom - plotTop;

      let xMin = Infinity;
      let xMax = -Infinity;
      let yMin = Infinity;
      let yMax = -Infinity;

      for (const s of series) {
        for (let i = 0; i < s.frequencies.length; i++) {
          xMin = Math.min(xMin, s.frequencies[i]);
          xMax = Math.max(xMax, s.frequencies[i]);
          yMin = Math.min(yMin, s.values[i]);
          yMax = Math.max(yMax, s.values[i]);
          if (s.ciLow) yMin = Math.min(yMin, s.ciLow[i]);
          if (s.ciHigh) yMax = Math.max(yMax, s.ciHigh[i]);
        }
      }

      if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return;
      if (xMax - xMin < 1e-9) xMax = xMin + 1;
      if (yMax - yMin < 1e-9) {
        yMin -= 1;
        yMax += 1;
      }

      const xToPx = (x: number) =>
        plotLeft + ((x - xMin) / (xMax - xMin)) * plotW;
      const yToPx = (y: number) =>
        plotBottom - ((y - yMin) / (yMax - yMin)) * plotH;

      ctx.strokeStyle = GRID_COLOR;
      for (let i = 0; i <= 4; i++) {
        const y = plotTop + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        const x = plotLeft + (plotW * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
      }

      for (const s of series) {
        if (
          s.ciLow &&
          s.ciHigh &&
          s.frequencies.length >= 2 &&
          s.ciLow.length === s.frequencies.length
        ) {
          ctx.fillStyle = hexToRgba(s.color, CI_ALPHA);
          ctx.beginPath();
          for (let i = 0; i < s.frequencies.length; i++) {
            const px = xToPx(s.frequencies[i]);
            const py = yToPx(s.ciHigh[i]);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          for (let i = s.frequencies.length - 1; i >= 0; i--) {
            const px = xToPx(s.frequencies[i]);
            const py = yToPx(s.ciLow[i]);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      for (const s of series) {
        if (s.frequencies.length < 2) continue;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.dashed ? 1.5 : 2;
        if (s.dashed) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < s.frequencies.length; i++) {
          const px = xToPx(s.frequencies[i]);
          const py = yToPx(s.values[i]);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = AXIS_COLOR;
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(xLabel, plotLeft + plotW / 2, plotBottom + 6);

      ctx.save();
      ctx.translate(14, plotTop + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 4; i++) {
        const val = yMin + ((yMax - yMin) * (4 - i)) / 4;
        const y = plotTop + (plotH * i) / 4;
        ctx.fillText(formatTick(val), plotLeft - 4, y);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= 4; i++) {
        const val = xMin + ((xMax - xMin) * i) / 4;
        const x = plotLeft + (plotW * i) / 4;
        ctx.fillText(formatTick(val), x, plotBottom + 2);
      }

      ctx.strokeStyle = "#666";
      ctx.strokeRect(plotLeft, plotTop, plotW, plotH);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [series, xLabel, yLabel, height]);

  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-border bg-[#1a1a1a] text-sm text-muted"
        style={{ height }}
      >
        �
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}
