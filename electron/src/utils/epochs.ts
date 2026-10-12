import type { Zone } from "@/api/types";

function zoneDuration(zone: Zone): number {
  return Math.max(0, zone.t_end - zone.t_start);
}

function epochParams(zone: Zone): { count: number; epochLen: number } | null {
  const duration = zoneDuration(zone);
  if (duration <= 0) return null;

  if (zone.epoch_mode === "duration") {
    const epochLen = Math.max(zone.epoch_value, 1e-6);
    const count = Math.ceil(duration / epochLen);
    return { count, epochLen };
  }

  const count = Math.max(Math.floor(zone.epoch_value), 1);
  const epochLen = duration / count;
  return { count, epochLen };
}

export function computeEpochCount(zone: Zone): number {
  return epochParams(zone)?.count ?? 0;
}

/** Configured epoch duration (s) for snapping and boundary display. */
export function getSnapEpochLength(
  zone: Zone,
  anchorT0: number,
  anchorT1: number,
): number {
  if (zone.epoch_mode === "duration") {
    return Math.max(zone.epoch_value, 1e-6);
  }
  const span = Math.max(anchorT1 - anchorT0, 0);
  const count = Math.max(Math.floor(zone.epoch_value), 1);
  return span > 0 ? span / count : Math.max(zone.epoch_value, 1e-6);
}

/** Snap a time to the nearest multiple of epochLen from anchorT0. */
export function snapTimeToEpochGrid(
  time: number,
  anchorT0: number,
  epochLen: number,
): number {
  const epochs = Math.round((time - anchorT0) / epochLen);
  return anchorT0 + epochs * epochLen;
}

export function computeEpochBoundaries(
  zone: Zone,
  tStart?: number,
  tEnd?: number,
): number[] {
  const start = tStart ?? zone.t_start;
  const end = tEnd ?? zone.t_end;
  const duration = Math.max(0, end - start);
  if (duration <= 0) return [];

  const epochLen = getSnapEpochLength(zone, start, end);
  const boundaries: number[] = [];
  for (let i = 1; ; i++) {
    const boundary = start + i * epochLen;
    if (boundary >= end - 1e-9) break;
    boundaries.push(boundary);
  }
  return boundaries;
}
