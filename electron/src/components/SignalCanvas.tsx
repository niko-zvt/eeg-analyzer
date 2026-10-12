import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore, type ChannelYRange } from "@/store/session";
import type { ChannelSegment, Zone } from "@/api/types";
import { useT } from "@/store/locale";
import {
  computeEpochBoundaries,
  getSnapEpochLength,
  snapTimeToEpochGrid,
} from "@/utils/epochs";
import { useMainSignalColor } from "@/hooks/useMainSignalColor";
import { nextZoneColor, normalizeZoneColor, zoneBorderColor, zoneFillColor } from "@/utils/zoneColors";
import { nextZoneName } from "@/utils/zoneNames";

const CHANNEL_LABEL_WIDTH = 52;
const AXIS_TITLE_WIDTH = 16;
const Y_TICK_WIDTH = 54;
const LABEL_WIDTH = CHANNEL_LABEL_WIDTH + AXIS_TITLE_WIDTH + Y_TICK_WIDTH;
const BAND_INNER_PAD = 14;
const TIME_AXIS_HEIGHT = 36;
const PLOT_PADDING_RIGHT = 8;
const GRID_COLOR = "rgba(255,255,255,0.08)";
const SERVICE_SIGNAL_COLOR = "#c9a227";
const DEFAULT_CREATE_EPOCH_LEN = 10;
const SERVICE_BAND_BG = "#252015";
const MAIN_BAND_BG_ALT = "#222222";
const MAIN_BAND_BG = "#1e1e1e";
const SERVICE_MAIN_RATIO = 2 / 3;
const SELECTION_COLOR = "rgba(255, 200, 0, 0.5)";
const EDGE_HIT_PX = 6;
const MIN_ZONE_SPAN = 0.05;
const DBLCLICK_MS = 300;
const BG = "#1e1e1e";
const LABEL_BG = "#1a1a1a";
const HINT_COLOR = "rgba(255, 235, 59, 0.85)";
const HINT_MS = 450;

type ScrollHint = "left" | "right" | null;
type ZoneDragMode = "create" | "move" | "resize-start" | "resize-end";

interface BandLayout {
  top: number;
  bottom: number;
  ch: ChannelSegment;
  chName: string;
  isService: boolean;
  bandIndex: number;
}

interface DragState {
  mode: ZoneDragMode;
  startX: number;
  startT: number;
  currentT: number;
  channelName: string;
  zoneId?: string;
  originT0?: number;
  originT1?: number;
  snapEpoch: boolean;
  snapEpochLen?: number;
}

interface ZoneHit {
  zone: Zone;
  mode: ZoneDragMode;
}

interface SignalCanvasProps {
  onEditZone: (zone: Zone) => void;
}

function clampRange(t0: number, t1: number, duration: number): [number, number] {
  let a = Math.max(0, Math.min(t0, t1));
  let b = Math.min(duration, Math.max(t0, t1));
  const span = b - a;
  if (span < 0.5) {
    b = Math.min(duration, a + 0.5);
  }
  if (a < 0) {
    b -= a;
    a = 0;
  }
  if (b > duration) {
    a -= b - duration;
    b = duration;
    a = Math.max(0, a);
  }
  return [a, b];
}

function xToTime(x: number, plotLeft: number, plotWidth: number, t0: number, t1: number): number {
  const frac = (x - plotLeft) / plotWidth;
  return t0 + frac * (t1 - t0);
}

function timeToX(t: number, plotLeft: number, plotWidth: number, t0: number, t1: number): number {
  const frac = (t - t0) / (t1 - t0);
  return plotLeft + frac * plotWidth;
}

function symmetricYRange(yMin: number, yMax: number): { yMin: number; yMax: number } {
  const abs = Math.max(Math.abs(yMin), Math.abs(yMax), 1e-9);
  return { yMin: -abs, yMax: abs };
}

function channelYRange(
  ch: ChannelSegment | undefined,
  locked: Record<string, ChannelYRange> | null,
  yLockActive: boolean,
  isService = false,
): { yMin: number; yMax: number } {
  let range: { yMin: number; yMax: number };
  if (ch && yLockActive && locked?.[ch.name]) {
    range = locked[ch.name];
  } else if (!ch) {
    range = { yMin: -1, yMax: 1 };
  } else {
    range = { yMin: ch.y_min, yMax: ch.y_max };
  }
  return isService ? symmetricYRange(range.yMin, range.yMax) : range;
}

function isZoneVisible(zone: Zone): boolean {
  return zone.visible !== false;
}

function computeBandLayouts(
  plotTop: number,
  plotBottom: number,
  mainChannels: ChannelSegment[],
  serviceChannels: ChannelSegment[],
): BandLayout[] {
  const plotHeight = plotBottom - plotTop;
  const nMain = mainChannels.length;
  const nService = serviceChannels.length;
  const layouts: BandLayout[] = [];
  let bandIndex = 0;

  if (nService === 0) {
    const bandH = plotHeight / Math.max(nMain, 1);
    for (let i = 0; i < nMain; i++) {
      const top = plotTop + i * bandH;
      layouts.push({
        top,
        bottom: top + bandH,
        ch: mainChannels[i],
        chName: mainChannels[i].name,
        isService: false,
        bandIndex: bandIndex++,
      });
    }
    return layouts;
  }

  const mainHeight = plotHeight * SERVICE_MAIN_RATIO;
  const serviceHeight = plotHeight * (1 - SERVICE_MAIN_RATIO);
  const mainBandH = mainHeight / Math.max(nMain, 1);
  const serviceBandH = serviceHeight / nService;

  for (let i = 0; i < nMain; i++) {
    const top = plotTop + i * mainBandH;
    layouts.push({
      top,
      bottom: top + mainBandH,
      ch: mainChannels[i],
      chName: mainChannels[i].name,
      isService: false,
      bandIndex: bandIndex++,
    });
  }
  for (let i = 0; i < nService; i++) {
    const top = plotTop + mainHeight + i * serviceBandH;
    layouts.push({
      top,
      bottom: top + serviceBandH,
      ch: serviceChannels[i],
      chName: serviceChannels[i].name,
      isService: true,
      bandIndex: bandIndex++,
    });
  }
  return layouts;
}

const MIN_WHEEL_DELTA = 0.5;

function isTimeZoomGesture(e: WheelEvent): boolean {
  const ax = Math.abs(e.deltaX);
  const ay = Math.abs(e.deltaY);
  return (
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    ay >= MIN_WHEEL_DELTA &&
    ay > ax
  );
}

/** Horizontal pan only; vertical trackpad component is ignored unless Shift converts wheel to pan. */
function horizontalWheelDelta(e: WheelEvent): number {
  const ax = Math.abs(e.deltaX);
  const ay = Math.abs(e.deltaY);

  if (e.shiftKey) {
    if (ax >= MIN_WHEEL_DELTA && ax >= ay) return e.deltaX;
    if (ay >= MIN_WHEEL_DELTA) return e.deltaY;
    return 0;
  }

  if (ax >= MIN_WHEEL_DELTA && ax > ay) {
    return e.deltaX;
  }

  return 0;
}

function hitBandAtY(y: number, layouts: BandLayout[]): BandLayout | null {
  for (const band of layouts) {
    if (y >= band.top && y < band.bottom) return band;
  }
  const last = layouts[layouts.length - 1];
  if (last && y >= last.top) return last;
  return null;
}

function cursorForDragMode(mode: ZoneDragMode): string {
  if (mode === "create") return "crosshair";
  if (mode === "move") return "grabbing";
  return "ew-resize";
}

function cursorForHit(mode: ZoneDragMode): string {
  if (mode === "move") return "move";
  return "ew-resize";
}

function zoneAppliesToChannel(zone: Zone, channel: string, allChannels: boolean): boolean {
  if (zone.channel === null || allChannels) return true;
  return zone.channel === channel;
}

function hitTestZone(
  x: number,
  time: number,
  chName: string,
  zoneList: Zone[],
  allChannels: boolean,
  plotLeft: number,
  plotWidth: number,
  t0: number,
  t1: number,
): ZoneHit | null {
  for (let i = zoneList.length - 1; i >= 0; i--) {
    const zone = zoneList[i];
    if (!isZoneVisible(zone)) continue;
    if (!zoneAppliesToChannel(zone, chName, allChannels)) continue;
    const zx0 = timeToX(zone.t_start, plotLeft, plotWidth, t0, t1);
    const zx1 = timeToX(zone.t_end, plotLeft, plotWidth, t0, t1);
    const left = Math.min(zx0, zx1);
    const right = Math.max(zx0, zx1);
    if (x < left - EDGE_HIT_PX || x > right + EDGE_HIT_PX) continue;
    if (Math.abs(x - left) <= EDGE_HIT_PX) return { zone, mode: "resize-start" };
    if (Math.abs(x - right) <= EDGE_HIT_PX) return { zone, mode: "resize-end" };
    if (time >= zone.t_start && time <= zone.t_end) return { zone, mode: "move" };
  }
  return null;
}

function createSelectionBounds(
  drag: DragState,
  fileDuration: number,
): { t0: number; t1: number } {
  let t0 = Math.min(drag.startT, drag.currentT);
  let t1 = Math.max(drag.startT, drag.currentT);

  if (!drag.snapEpoch) {
    return { t0, t1 };
  }

  const epochLen = drag.snapEpochLen ?? DEFAULT_CREATE_EPOCH_LEN;
  const anchor = drag.startT;

  if (drag.currentT >= drag.startT) {
    t0 = snapTimeToEpochGrid(drag.startT, anchor, epochLen);
    t1 = snapTimeToEpochGrid(drag.currentT, anchor, epochLen);
    if (t1 <= t0) t1 = t0 + epochLen;
  } else {
    t1 = snapTimeToEpochGrid(drag.startT, anchor, epochLen);
    t0 = snapTimeToEpochGrid(drag.currentT, anchor, epochLen);
    if (t1 <= t0) t0 = t1 - epochLen;
  }

  t0 = Math.max(0, t0);
  t1 = Math.min(fileDuration, t1);
  if (t1 - t0 < epochLen) {
    if (t0 + epochLen <= fileDuration) t1 = t0 + epochLen;
    else t0 = Math.max(0, t1 - epochLen);
  }
  return { t0, t1 };
}

function previewBounds(
  drag: DragState,
  fileDuration: number,
  zone?: Zone,
): { t0: number; t1: number; zoneId?: string } | null {
  if (drag.mode === "create") {
    return createSelectionBounds(drag, fileDuration);
  }
  if (drag.originT0 === undefined || drag.originT1 === undefined) return null;
  const delta = drag.currentT - drag.startT;
  if (drag.mode === "move") {
    let t0 = drag.originT0 + delta;
    let t1 = drag.originT1 + delta;
    if (t0 < 0) {
      t1 -= t0;
      t0 = 0;
    }
    if (t1 > fileDuration) {
      t0 -= t1 - fileDuration;
      t1 = fileDuration;
      t0 = Math.max(0, t0);
    }
    return { t0, t1, zoneId: drag.zoneId };
  }
  if (drag.mode === "resize-start") {
    if (drag.snapEpoch && zone && drag.originT0 !== undefined && drag.originT1 !== undefined) {
      const epochLen =
        drag.snapEpochLen ??
        getSnapEpochLength(zone, drag.originT0, drag.originT1);
      let t0 = snapTimeToEpochGrid(drag.currentT, drag.originT0, epochLen);
      t0 = Math.max(0, Math.min(t0, drag.originT1 - epochLen));
      return { t0, t1: drag.originT1, zoneId: drag.zoneId };
    }
    const t0 = Math.max(0, Math.min(drag.currentT, drag.originT1 - MIN_ZONE_SPAN));
    return { t0, t1: drag.originT1, zoneId: drag.zoneId };
  }
  if (drag.mode === "resize-end") {
    if (drag.snapEpoch && zone && drag.originT0 !== undefined && drag.originT1 !== undefined) {
      const epochLen =
        drag.snapEpochLen ??
        getSnapEpochLength(zone, drag.originT0, drag.originT1);
      let t1 = snapTimeToEpochGrid(drag.currentT, drag.originT0, epochLen);
      t1 = Math.min(fileDuration, Math.max(t1, drag.originT0 + epochLen));
      return { t0: drag.originT0, t1, zoneId: drag.zoneId };
    }
    const t1 = Math.min(
      fileDuration,
      Math.max(drag.currentT, drag.originT0 + MIN_ZONE_SPAN),
    );
    return { t0: drag.originT0, t1, zoneId: drag.zoneId };
  }
  return null;
}

function drawEpochLines(
  ctx: CanvasRenderingContext2D,
  boundaries: number[],
  left: number,
  right: number,
  bandTop: number,
  bandBottom: number,
  plotLeft: number,
  plotRight: number,
  plotWidth: number,
  viewT0: number,
  viewT1: number,
  strokeStyle: string,
  lineWidth: number,
  dash: number[],
) {
  if (boundaries.length === 0) return;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  for (const boundary of boundaries) {
    const x = timeToX(boundary, plotLeft, plotWidth, viewT0, viewT1);
    if (x <= left || x >= right || x < plotLeft || x > plotRight) continue;
    ctx.beginPath();
    ctx.moveTo(x, bandTop + 1);
    ctx.lineTo(x, bandBottom - 1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCreateSelection(
  ctx: CanvasRenderingContext2D,
  drag: DragState,
  fileDuration: number,
  plotLeft: number,
  plotRight: number,
  plotWidth: number,
  viewT0: number,
  viewT1: number,
  bandTop: number,
  bandBottom: number,
  bandH: number,
) {
  const { t0: selT0, t1: selT1 } = createSelectionBounds(drag, fileDuration);
  const sx0 = timeToX(selT0, plotLeft, plotWidth, viewT0, viewT1);
  const sx1 = timeToX(selT1, plotLeft, plotWidth, viewT0, viewT1);
  const left = Math.max(plotLeft, Math.min(sx0, sx1));
  const right = Math.min(plotRight, Math.max(sx0, sx1));
  if (right <= left) return;

  ctx.fillStyle = SELECTION_COLOR;
  ctx.fillRect(left, bandTop + 1, right - left, bandH - 2);

  const epochLen = drag.snapEpochLen ?? DEFAULT_CREATE_EPOCH_LEN;
  const previewZone: Zone = {
    id: "preview",
    name: "",
    t_start: selT0,
    t_end: selT1,
    channel: null,
    epoch_mode: "duration",
    epoch_value: epochLen,
    color: "#ffc800",
    visible: true,
  };
  const boundaries = computeEpochBoundaries(previewZone, selT0, selT1);
  drawEpochLines(
    ctx,
    boundaries,
    left,
    right,
    bandTop,
    bandBottom,
    plotLeft,
    plotRight,
    plotWidth,
    viewT0,
    viewT1,
    "rgba(255, 220, 80, 0.9)",
    1.5,
    [4, 3],
  );
}

function drawZoneRect(
  ctx: CanvasRenderingContext2D,
  zone: Zone,
  tStart: number,
  tEnd: number,
  selected: boolean,
  plotLeft: number,
  plotWidth: number,
  viewT0: number,
  viewT1: number,
  bandTop: number,
  bandBottom: number,
  bandH: number,
) {
  const color = normalizeZoneColor(zone.color);
  const zx0 = timeToX(tStart, plotLeft, plotWidth, viewT0, viewT1);
  const zx1 = timeToX(tEnd, plotLeft, plotWidth, viewT0, viewT1);
  const plotRight = plotLeft + plotWidth;
  const left = Math.max(plotLeft, Math.min(zx0, zx1));
  const right = Math.min(plotRight, Math.max(zx0, zx1));
  if (right <= left) return;

  ctx.fillStyle = zoneFillColor(color, selected ? 0.55 : 0.35);
  ctx.fillRect(left, bandTop + 1, right - left, bandH - 2);

  if (selected) {
    ctx.strokeStyle = zoneBorderColor(color);
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(left + 0.5, bandTop + 1.5, right - left - 1, bandH - 3);
  }

  const previewZone = { ...zone, t_start: tStart, t_end: tEnd };
  const boundaries = computeEpochBoundaries(previewZone, tStart, tEnd);
  drawEpochLines(
    ctx,
    boundaries,
    left,
    right,
    bandTop,
    bandBottom,
    plotLeft,
    plotRight,
    plotWidth,
    viewT0,
    viewT1,
    zoneFillColor(color, selected ? 0.95 : 0.6),
    selected ? 1.5 : 1,
    selected ? [5, 4] : [3, 3],
  );
}

function truncateLabel(name: string, max = 7): string {
  return name.length > max ? `${name.slice(0, max - 1)}\u2026` : name;
}

function niceTimeStep(spanSec: number, targetTicks = 7): number {
  if (spanSec <= 0) return 1;
  const raw = spanSec / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = mag;
  if (norm > 5) step = 10 * mag;
  else if (norm > 2) step = 5 * mag;
  else if (norm > 1) step = 2 * mag;
  return Math.max(step, 0.001);
}

function formatTimeSec(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(1)}`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(1)}`;
  }
  if (sec < 10) return sec.toFixed(2);
  return sec.toFixed(1);
}

function formatAmplitude(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(val / 1e3).toFixed(0)}k`;
  if (abs >= 1000) return val.toFixed(0);
  if (abs >= 100) return val.toFixed(0);
  if (abs >= 10) return val.toFixed(1);
  if (abs >= 1) return val.toFixed(2);
  return val.toFixed(3);
}

function yTicks(yMin: number, yMax: number): number[] {
  const ticks = [yMax, yMin];
  if (yMin < 0 && yMax > 0) ticks.splice(1, 0, 0);
  const mid = (yMin + yMax) / 2;
  if (mid !== 0 && mid !== yMin && mid !== yMax) ticks.splice(1, 0, mid);
  return [...new Set(ticks)].sort((a, b) => b - a);
}

function valueToBandY(
  val: number,
  yMin: number,
  yMax: number,
  bandTop: number,
  bandBottom: number,
  pad: number = BAND_INNER_PAD,
): number {
  const span = Math.max(yMax - yMin, 1e-9);
  const norm = (val - yMin) / span;
  const top = bandTop + pad;
  const bottom = bandBottom - pad;
  return bottom - norm * (bottom - top);
}

function drawScrollHint(
  ctx: CanvasRenderingContext2D,
  hint: ScrollHint,
  plotLeft: number,
  plotTop: number,
  plotWidth: number,
  plotHeight: number,
) {
  if (!hint) return;
  const y = plotTop + plotHeight * 0.5;
  const margin = Math.max(24, plotWidth * 0.06);
  ctx.save();
  ctx.font = "bold 22px Inter, sans-serif";
  ctx.fillStyle = HINT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (hint === "left") {
    ctx.fillText("\u25c0", plotLeft + margin, y);
  } else {
    ctx.fillText("\u25b6", plotLeft + plotWidth - margin, y);
  }
  ctx.restore();
}

export function SignalCanvas({ onEditZone }: SignalCanvasProps) {
  const t = useT();
  const mainSignalColor = useMainSignalColor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const fetchTimer = useRef<ReturnType<typeof setTimeout>>();
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastClickRef = useRef<{ zoneId: string; time: number } | null>(null);
  const fileInfo = useSessionStore((s) => s.fileInfo);
  const segment = useSessionStore((s) => s.segment);
  const zones = useSessionStore((s) => s.zones);
  const viewRange = useSessionStore((s) => s.viewRange);
  const duration = useSessionStore((s) => s.duration);
  const zoneOnAllChannels = useSessionStore((s) => s.zoneOnAllChannels);
  const selectedChannels = useSessionStore((s) => s.selectedChannels);
  const serviceChannels = useSessionStore((s) => s.serviceChannels);
  const selectedZoneId = useSessionStore((s) => s.selectedZoneId);
  const channelsPerPage = useSessionStore((s) => s.channelsPerPage);
  const channelPage = useSessionStore((s) => s.channelPage);
  const yLockActive = useSessionStore((s) => s.yLockActive);
  const lockedChannelY = useSessionStore((s) => s.lockedChannelY);
  const setViewRange = useSessionStore((s) => s.setViewRange);
  const fetchSegment = useSessionStore((s) => s.fetchSegment);
  const addZone = useSessionStore((s) => s.addZone);
  const updateZone = useSessionStore((s) => s.updateZone);
  const setSelectedZoneId = useSessionStore((s) => s.setSelectedZoneId);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [scrollHint, setScrollHint] = useState<ScrollHint>(null);
  const [canvasCursor, setCanvasCursor] = useState("crosshair");

  const showScrollHint = useCallback((direction: ScrollHint) => {
    if (!direction) return;
    setScrollHint(direction);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setScrollHint(null), HINT_MS);
  }, []);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const scheduleFetch = useCallback(
    (width: number) => {
      if (!fileInfo || selectedChannels.length === 0) return;
      clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => {
        void fetchSegment(width);
      }, 80);
    },
    [fetchSegment, fileInfo, selectedChannels.length],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setSize({ width: rect.width, height: rect.height });
        scheduleFetch(Math.max(100, Math.floor(rect.width - LABEL_WIDTH)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleFetch]);

  useEffect(() => {
    scheduleFetch(Math.max(100, Math.floor(size.width - LABEL_WIDTH)));
  }, [viewRange, scheduleFetch, size.width]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size.width;
    const h = size.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const serviceSet = new Set(serviceChannels);
    const allSegmentChannels = segment?.channels ?? [];
    const mainInSegment = allSegmentChannels.filter((c) => !serviceSet.has(c.name));
    const serviceInSegment = allSegmentChannels.filter((c) => serviceSet.has(c.name));
    const pageStart = channelPage * channelsPerPage;
    const pageMainChannels = mainInSegment.slice(
      pageStart,
      pageStart + channelsPerPage,
    );

    const plotTop = 4;
    const plotBottom = h - TIME_AXIS_HEIGHT;
    const plotHeight = plotBottom - plotTop;
    const plotLeft = LABEL_WIDTH;
    const plotRight = w - PLOT_PADDING_RIGHT;
    const plotWidth = plotRight - plotLeft;
    const { t0, t1 } = viewRange;

    const layouts = computeBandLayouts(
      plotTop,
      plotBottom,
      pageMainChannels,
      serviceInSegment,
    );

    if (layouts.length === 0) {
      ctx.fillStyle = "#888";
      ctx.font = "14px Inter, sans-serif";
      ctx.fillText(t.openForInfo, 16, 32);
      return;
    }

    ctx.fillStyle = LABEL_BG;
    ctx.fillRect(0, plotTop, plotLeft, plotHeight);

    if (serviceInSegment.length > 0 && pageMainChannels.length > 0) {
      const dividerY = plotTop + plotHeight * SERVICE_MAIN_RATIO;
      ctx.strokeStyle = "rgba(201, 162, 39, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, dividerY);
      ctx.lineTo(plotRight, dividerY);
      ctx.stroke();
    }

    let mainBandIdx = 0;
    for (const band of layouts) {
      const { top: bandTop, bottom: bandBottom, ch, chName, isService } = band;
      const bandH = bandBottom - bandTop;
      const { yMin, yMax } = channelYRange(ch, lockedChannelY, yLockActive, isService);

      if (isService) {
        ctx.fillStyle = SERVICE_BAND_BG;
      } else {
        ctx.fillStyle = mainBandIdx % 2 === 0 ? MAIN_BAND_BG : MAIN_BAND_BG_ALT;
        mainBandIdx++;
      }
      ctx.fillRect(plotLeft, bandTop, plotWidth, bandH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, bandTop + 1, plotWidth, bandH - 2);
      ctx.clip();

      const chData = ch?.data;
      const times = segment?.times;
      if (chData && times && chData.length > 1) {
        ctx.strokeStyle = isService ? SERVICE_SIGNAL_COLOR : mainSignalColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j < chData.length; j++) {
          const x = timeToX(times[j], plotLeft, plotWidth, t0, t1);
          if (x < plotLeft - 1 || x > plotRight + 1) {
            started = false;
            continue;
          }
          const y = valueToBandY(chData[j], yMin, yMax, bandTop, bandBottom);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      for (const zone of zones) {
        if (!isZoneVisible(zone)) continue;
        if (!zoneAppliesToChannel(zone, chName, zoneOnAllChannels)) continue;
        let zStart = zone.t_start;
        let zEnd = zone.t_end;
        if (
          drag &&
          drag.zoneId === zone.id &&
          drag.mode !== "create" &&
          (zoneOnAllChannels || drag.channelName === chName)
        ) {
          const preview = previewBounds(drag, duration, zone);
          if (preview) {
            zStart = preview.t0;
            zEnd = preview.t1;
          }
        }
        drawZoneRect(
          ctx,
          zone,
          zStart,
          zEnd,
          zone.id === selectedZoneId,
          plotLeft,
          plotWidth,
          t0,
          t1,
          bandTop,
          bandBottom,
          bandH,
        );
      }

      if (
        drag?.mode === "create" &&
        (zoneOnAllChannels || drag.channelName === chName)
      ) {
        drawCreateSelection(
          ctx,
          drag,
          duration,
          plotLeft,
          plotRight,
          plotWidth,
          t0,
          t1,
          bandTop,
          bandBottom,
          bandH,
        );
      }

      ctx.restore();

      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(plotLeft, bandBottom);
      ctx.lineTo(plotRight, bandBottom);
      ctx.stroke();
    }

    ctx.fillStyle = LABEL_BG;
    ctx.fillRect(0, plotTop, plotLeft, plotHeight);
    const axisTitleX = CHANNEL_LABEL_WIDTH + AXIS_TITLE_WIDTH / 2;
    for (const band of layouts) {
      const { top: bandTop, bottom: bandBottom, ch, chName, isService } = band;
      const bandH = bandBottom - bandTop;
      const chCenter = bandTop + bandH / 2;
      const { yMin, yMax } = channelYRange(ch, lockedChannelY, yLockActive, isService);
      const labelFont = isService && bandH < 28 ? "8px Inter, sans-serif" : "10px Inter, sans-serif";
      const tickFont = isService && bandH < 28 ? "7px Inter, sans-serif" : "9px Inter, sans-serif";

      ctx.fillStyle = isService ? "#b8a060" : "#cccccc";
      ctx.font = labelFont;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(truncateLabel(chName), CHANNEL_LABEL_WIDTH - 4, chCenter);

      if (!isService) {
        ctx.save();
        ctx.fillStyle = "#888";
        ctx.font = tickFont;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.translate(axisTitleX, chCenter);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(t.voltageAxis, 0, 0);
        ctx.restore();
      }

      if (!isService || bandH >= 16) {
        ctx.fillStyle = "#999";
        ctx.font = tickFont;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const ticks = yTicks(yMin, yMax);
        const tickStep = isService && bandH < 24 ? Math.max(1, Math.ceil(ticks.length / 2)) : 1;
        for (let ti = 0; ti < ticks.length; ti += tickStep) {
          const tickVal = ticks[ti];
          const y = valueToBandY(tickVal, yMin, yMax, bandTop, bandBottom);
          ctx.fillText(formatAmplitude(tickVal), plotLeft - 4, y);
          ctx.strokeStyle = GRID_COLOR;
          ctx.beginPath();
          ctx.moveTo(plotLeft, y);
          ctx.lineTo(plotRight, y);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight);

    const span = t1 - t0;
    const step = niceTimeStep(span);
    const firstTick = Math.ceil(t0 / step) * step;
    ctx.fillStyle = "#aaa";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.strokeStyle = GRID_COLOR;
    for (let tickTime = firstTick; tickTime <= t1 + step * 0.01; tickTime += step) {
      if (tickTime < t0 - 1e-9) continue;
      const x = timeToX(tickTime, plotLeft, plotWidth, t0, t1);
      if (x < plotLeft || x > plotRight) continue;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, plotBottom);
      ctx.lineTo(x, plotBottom + 5);
      ctx.strokeStyle = "#666";
      ctx.stroke();
      ctx.strokeStyle = GRID_COLOR;
      ctx.fillStyle = "#aaa";
      ctx.fillText(`${formatTimeSec(tickTime)} s`, x, plotBottom + 7);
    }
    ctx.fillStyle = "#888";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText(`${t.timeAxis} (s)`, plotLeft + plotWidth / 2, h - 12);

    drawScrollHint(ctx, scrollHint, plotLeft, plotTop, plotWidth, plotHeight);
  }, [
    segment,
    zones,
    viewRange,
    selectedChannels,
    serviceChannels,
    mainSignalColor,
    zoneOnAllChannels,
    selectedZoneId,
    channelsPerPage,
    channelPage,
    yLockActive,
    lockedChannelY,
    drag,
    duration,
    size,
    t,
    scrollHint,
  ]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const scrollTimeHorizontally = (delta: number) => {
    if (Math.abs(delta) < 1e-6 || duration <= 0) return;
    const { t0, t1 } = viewRange;
    const span = t1 - t0;
    if (span <= 0) return;
    const magnitude = Math.min(0.25, Math.max(0.06, Math.abs(delta) * 0.003));
    const step = span * magnitude * Math.sign(delta);
    let newT0 = t0 + step;
    let newT1 = t1 + step;
    const prevT0 = t0;
    [newT0, newT1] = clampRange(newT0, newT1, duration);
    if (Math.abs(newT0 - prevT0) > 1e-9) {
      setViewRange({ t0: newT0, t1: newT1 });
      showScrollHint(delta > 0 ? "right" : "left");
    }
  };

  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});

  wheelHandlerRef.current = (e: WheelEvent) => {
    const plotLeft = LABEL_WIDTH;
    const plotWidth = size.width - plotLeft - PLOT_PADDING_RIGHT;
    const { t0, t1 } = viewRange;
    const span = t1 - t0;
    if (span <= 0 || duration <= 0) return;

    if (isTimeZoomGesture(e)) {
      e.preventDefault();
      e.stopPropagation();
      const scale = e.deltaY < 0 ? 0.9 : 1.1;
      const rect = canvasRef.current?.getBoundingClientRect();
      const mouseX = rect ? e.clientX - rect.left : plotLeft + plotWidth / 2;
      const centerT = xToTime(mouseX, plotLeft, plotWidth, t0, t1);
      const newSpan = Math.min(duration, Math.max(0.5, span * scale));
      const ratio = (centerT - t0) / span;
      let newT0 = centerT - ratio * newSpan;
      let newT1 = newT0 + newSpan;
      [newT0, newT1] = clampRange(newT0, newT1, duration);
      setViewRange({ t0: newT0, t1: newT1 });
      return;
    }

    const delta = horizontalWheelDelta(e);
    if (delta === 0) return;

    e.preventDefault();
    e.stopPropagation();
    scrollTimeHorizontally(delta);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheelHandlerRef.current(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fileInfo]);

  const getBandLayouts = useCallback(() => {
    const serviceSet = new Set(serviceChannels);
    const allSegmentChannels = segment?.channels ?? [];
    const mainInSegment = allSegmentChannels.filter((c) => !serviceSet.has(c.name));
    const serviceInSegment = allSegmentChannels.filter((c) => serviceSet.has(c.name));
    const pageStart = channelPage * channelsPerPage;
    const pageMainChannels = mainInSegment.slice(
      pageStart,
      pageStart + channelsPerPage,
    );
    const plotTop = 4;
    const plotBottom = size.height - TIME_AXIS_HEIGHT;
    return computeBandLayouts(plotTop, plotBottom, pageMainChannels, serviceInSegment);
  }, [segment, serviceChannels, channelPage, channelsPerPage, size.height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const layouts = getBandLayouts();
    if (layouts.length === 0) return;
    const plotLeft = LABEL_WIDTH;
    const plotWidth = size.width - plotLeft - PLOT_PADDING_RIGHT;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < plotLeft || x > plotLeft + plotWidth) return;
    const band = hitBandAtY(y, layouts);
    if (!band) return;
    const chName = band.chName;
    const time = xToTime(x, plotLeft, plotWidth, viewRange.t0, viewRange.t1);
    const visibleZones = zones.filter(isZoneVisible);
    const hit = hitTestZone(
      x,
      time,
      chName,
      visibleZones,
      zoneOnAllChannels,
      plotLeft,
      plotWidth,
      viewRange.t0,
      viewRange.t1,
    );
    if (hit) {
      setSelectedZoneId(hit.zone.id);
      setDrag({
        mode: hit.mode,
        startX: x,
        startT: time,
        currentT: time,
        channelName: chName,
        zoneId: hit.zone.id,
        originT0: hit.zone.t_start,
        originT1: hit.zone.t_end,
        snapEpoch: e.ctrlKey || e.metaKey,
        snapEpochLen: getSnapEpochLength(
          hit.zone,
          hit.zone.t_start,
          hit.zone.t_end,
        ),
      });
      setCanvasCursor(cursorForDragMode(hit.mode));
      return;
    }
    setSelectedZoneId(null);
    setDrag({
      mode: "create",
      startX: x,
      startT: time,
      currentT: time,
      channelName: chName,
      snapEpoch: e.ctrlKey || e.metaKey,
      snapEpochLen: DEFAULT_CREATE_EPOCH_LEN,
    });
    setCanvasCursor("crosshair");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const plotLeft = LABEL_WIDTH;
    const plotWidth = size.width - plotLeft - PLOT_PADDING_RIGHT;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const layouts = getBandLayouts();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inPlot = x >= plotLeft && x <= plotLeft + plotWidth && layouts.length > 0;

    if (drag && inPlot) {
      const clampedX = Math.max(plotLeft, Math.min(x, plotLeft + plotWidth));
      const time = xToTime(clampedX, plotLeft, plotWidth, viewRange.t0, viewRange.t1);
      setDrag({
        ...drag,
        currentT: time,
        snapEpoch: e.ctrlKey || e.metaKey,
      });
      setCanvasCursor(cursorForDragMode(drag.mode));
      return;
    }

    if (!inPlot) {
      setCanvasCursor("crosshair");
      return;
    }

    const band = hitBandAtY(y, layouts);
    if (!band) {
      setCanvasCursor("crosshair");
      return;
    }
    const chName = band.chName;
    const time = xToTime(x, plotLeft, plotWidth, viewRange.t0, viewRange.t1);
    const visibleZones = zones.filter(isZoneVisible);
    const hit = hitTestZone(
      x,
      time,
      chName,
      visibleZones,
      zoneOnAllChannels,
      plotLeft,
      plotWidth,
      viewRange.t0,
      viewRange.t1,
    );
    setCanvasCursor(hit ? cursorForHit(hit.mode) : "crosshair");
  };

  const handleMouseUp = async () => {
    if (!drag) return;
    const currentDrag = drag;
    setDrag(null);

    if (currentDrag.mode === "create") {
      const preview = createSelectionBounds(currentDrag, duration);
      const t0 = preview.t0;
      const t1 = preview.t1;
      if (t1 - t0 < MIN_ZONE_SPAN) return;
      const epochLen = currentDrag.snapEpochLen ?? DEFAULT_CREATE_EPOCH_LEN;
      await addZone({
        name: nextZoneName(zones, t.zoneNamePrefix),
        t_start: t0,
        t_end: t1,
        channel: zoneOnAllChannels ? null : currentDrag.channelName,
        epoch_mode: "duration",
        epoch_value: epochLen,
        color: nextZoneColor(zones),
        visible: true,
      });
      return;
    }

    if (!currentDrag.zoneId) return;
    const zone = zones.find((z) => z.id === currentDrag.zoneId);
    const preview = previewBounds(currentDrag, duration, zone);
    if (!preview) return;

    const moved = Math.abs(currentDrag.currentT - currentDrag.startT) > 0.02;
    if (currentDrag.mode === "move" && !moved) {
      const now = Date.now();
      if (
        lastClickRef.current?.zoneId === currentDrag.zoneId &&
        now - lastClickRef.current.time < DBLCLICK_MS
      ) {
        const zone = zones.find((z) => z.id === currentDrag.zoneId);
        if (zone) onEditZone(zone);
        lastClickRef.current = null;
        return;
      }
      lastClickRef.current = { zoneId: currentDrag.zoneId, time: now };
      return;
    }

    if (preview.t1 - preview.t0 < MIN_ZONE_SPAN) return;
    await updateZone(currentDrag.zoneId, {
      t_start: preview.t0,
      t_end: preview.t1,
    });
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-0"
      style={{ overscrollBehavior: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ cursor: canvasCursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDrag(null);
          setCanvasCursor("crosshair");
        }}
      />
    </div>
  );
}
