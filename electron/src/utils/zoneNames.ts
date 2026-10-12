import type { Zone } from "@/api/types";

export function nextZoneName(zones: Zone[], prefix: string): string {
  const used = new Set(zones.map((z) => z.name));
  let n = zones.length + 1;
  while (used.has(`${prefix} ${n}`)) n += 1;
  return `${prefix} ${n}`;
}
