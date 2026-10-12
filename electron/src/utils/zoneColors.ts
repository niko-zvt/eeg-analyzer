import type { Zone } from "@/api/types";

export const ZONE_PALETTE = [
  "#81c784",
  "#ffb74d",
  "#e57373",
  "#4fc3f7",
  "#7986cb",
  "#ba68c8",
  "#4db6ac",
  "#aed581",
  "#f06292",
  "#ff8a65",
];

export const DEFAULT_ZONE_COLOR = "#ffc800";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function zoneFillColor(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function zoneBorderColor(hex: string): string {
  return hex;
}

export function nextZoneColor(zones: Zone[]): string {
  const used = new Set(zones.map((z) => normalizeZoneColor(z.color)));
  for (const color of ZONE_PALETTE) {
    if (!used.has(color)) return color;
  }
  return ZONE_PALETTE[zones.length % ZONE_PALETTE.length];
}

export function normalizeZoneColor(color: string | undefined): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_ZONE_COLOR;
}
