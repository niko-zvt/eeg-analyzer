import { create } from "zustand";
import { api } from "@/api/client";
import type {
  ChannelGroup,
  FileInfo,
  FilterSettings,
  OpenResponse,
  SegmentResponse,
  Zone,
} from "@/api/types";
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryEntry,
} from "./history";

export interface ViewRange {
  t0: number;
  t1: number;
}

export interface ChannelYRange {
  yMin: number;
  yMax: number;
}

interface SessionStore {
  ready: boolean;
  loading: boolean;
  error: string | null;

  fileInfo: FileInfo | null;
  channelGroups: ChannelGroup[];
  selectedChannels: string[];
  serviceChannels: string[];
  duration: number;

  zones: Zone[];
  zoneHistory: HistoryEntry<Zone[]>;
  zoneOnAllChannels: boolean;
  selectedZoneId: string | null;
  channelsPerPage: number;
  channelPage: number;

  ampMultiplier: number;
  appliedFilters: FilterSettings;
  viewRange: ViewRange;
  defaultWindow: number;

  segment: SegmentResponse | null;
  pendingOpen: OpenResponse | null;
  yLockActive: boolean;
  lockedChannelY: Record<string, ChannelYRange> | null;

  lockChannelYFromSegment: (segment: SegmentResponse) => void;
  clearChannelYLock: () => void;

  setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setPendingOpen: (data: OpenResponse | null) => void;

  openFile: (path: string) => Promise<OpenResponse>;
  confirmSelection: (
    channels: string[],
    serviceChannels: string[],
    tmin: number,
    tmax: number,
    channelsPerPage: number,
    zones?: Zone[],
  ) => Promise<void>;

  setViewRange: (range: ViewRange) => void;
  resetView: () => void;
  showAll: () => void;
  setAmpMultiplier: (value: number) => Promise<void>;
  setZoneOnAllChannels: (enabled: boolean) => Promise<void>;
  setSelectedZoneId: (id: string | null) => void;
  setChannelPage: (page: number) => void;
  centerViewOnZone: (id: string) => void;

  fetchSegment: (width: number) => Promise<void>;

  addZone: (zone: Omit<Zone, "id">) => Promise<void>;
  updateZone: (id: string, updates: Partial<Zone>) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
  deleteAllZones: () => Promise<void>;
  setZonesLocal: (zones: Zone[], pushToHistory?: boolean) => void;
  undoZones: () => Promise<void>;
  redoZones: () => Promise<void>;

  applyFilters: (settings: FilterSettings) => Promise<void>;
  resetFilters: () => Promise<void>;
  saveProject: () => Promise<string>;
  loadProject: (path?: string | null) => Promise<void>;
}

async function syncZones(zones: Zone[]): Promise<Zone[]> {
  return api.replaceZones(zones);
}

function clampViewRange(t0: number, t1: number, duration: number): ViewRange {
  let a = t0;
  let b = t1;
  const span = b - a;
  if (a < 0) {
    b -= a;
    a = 0;
  }
  if (b > duration) {
    a -= b - duration;
    b = duration;
    a = Math.max(0, a);
  }
  if (b - a < span - 1e-6 && span > 0) {
    if (a === 0) b = Math.min(duration, span);
    else if (b === duration) a = Math.max(0, duration - span);
  }
  return { t0: a, t1: b };
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  ready: false,
  loading: false,
  error: null,

  fileInfo: null,
  channelGroups: [],
  selectedChannels: [],
  serviceChannels: [],
  duration: 0,

  zones: [],
  zoneHistory: createHistory<Zone[]>([]),
  zoneOnAllChannels: true,
  selectedZoneId: null,
  channelsPerPage: 2,
  channelPage: 0,

  ampMultiplier: 1,
  appliedFilters: { highpass: null, lowpass: null, notch: null },
  viewRange: { t0: 0, t1: 30 },
  defaultWindow: 30,

  segment: null,
  pendingOpen: null,
  yLockActive: false,
  lockedChannelY: null,

  lockChannelYFromSegment: (segment) => {
    const locked: Record<string, ChannelYRange> = {};
    for (const ch of segment.channels) {
      locked[ch.name] = { yMin: ch.y_min, yMax: ch.y_max };
    }
    set({ yLockActive: true, lockedChannelY: locked });
  },

  clearChannelYLock: () => set({ yLockActive: false, lockedChannelY: null }),

  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
  setPendingOpen: (data) => set({ pendingOpen: data, error: null }),

  openFile: async (path) => {
    set({ loading: true, error: null });
    try {
      const data = await api.openFile(path);
      set({ pendingOpen: data, loading: false });
      return data;
    } catch (err) {
      set({ loading: false, error: String(err) });
      throw err;
    }
  },

  confirmSelection: async (channels, serviceChannels, tmin, tmax, channelsPerPage, zones) => {
    const pending = get().pendingOpen;
    if (!pending) return;
    set({ loading: true, error: null });
    try {
      await api.setZoneOnAllChannels(pending.zone_on_all_channels);
      const result = await api.selectChannels(channels, serviceChannels, tmin, tmax);
      const initialZones = zones ?? pending.saved_zones ?? [];
      const synced = initialZones.length ? await syncZones(initialZones) : [];
      const duration = result.duration;
      set({
        fileInfo: pending.file_info,
        channelGroups: pending.channel_groups,
        selectedChannels: channels,
        serviceChannels,
        duration,
        zones: synced,
        zoneHistory: createHistory(synced),
        zoneOnAllChannels: pending.zone_on_all_channels,
        viewRange: { t0: 0, t1: duration },
        selectedZoneId: null,
        channelsPerPage: Math.max(1, channelsPerPage),
        channelPage: 0,
        pendingOpen: null,
        loading: false,
        yLockActive: false,
        lockedChannelY: null,
      });
    } catch (err) {
      set({ loading: false, error: String(err) });
      throw err;
    }
  },

  setViewRange: (range) => set({ viewRange: range }),

  resetView: () => {
    const { duration, defaultWindow } = get();
    get().clearChannelYLock();
    set({ viewRange: { t0: 0, t1: Math.min(defaultWindow, duration) } });
  },

  showAll: () => {
    const { duration } = get();
    get().clearChannelYLock();
    set({ viewRange: { t0: 0, t1: duration } });
  },

  setAmpMultiplier: async (value) => {
    await api.setAmpMultiplier(value);
    set({ ampMultiplier: value });
    await get().fetchSegment(1000);
  },

  setZoneOnAllChannels: async (enabled) => {
    await api.setZoneOnAllChannels(enabled);
    set({ zoneOnAllChannels: enabled });
  },

  setSelectedZoneId: (id) => set({ selectedZoneId: id }),

  setChannelPage: (page) => {
    const { selectedChannels, channelsPerPage } = get();
    const totalPages = Math.max(
      1,
      Math.ceil(selectedChannels.length / Math.max(1, channelsPerPage)),
    );
    set({ channelPage: Math.max(0, Math.min(page, totalPages - 1)) });
  },

  centerViewOnZone: (id) => {
    const { zones, viewRange, duration, zoneOnAllChannels, selectedChannels, channelsPerPage } =
      get();
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;

    const zoneCenter = (zone.t_start + zone.t_end) / 2;
    const span = viewRange.t1 - viewRange.t0;
    const next = clampViewRange(zoneCenter - span / 2, zoneCenter + span / 2, duration);
    set({ viewRange: next });

    if (!zoneOnAllChannels && zone.channel) {
      const idx = selectedChannels.indexOf(zone.channel);
      if (idx >= 0) {
        get().setChannelPage(Math.floor(idx / Math.max(1, channelsPerPage)));
      }
    }
  },

  fetchSegment: async (width) => {
    const { fileInfo, selectedChannels, viewRange, ampMultiplier } = get();
    if (!fileInfo || selectedChannels.length === 0) return;
    try {
      const segment = await api.getSegment(
        viewRange.t0,
        viewRange.t1,
        width,
        ampMultiplier,
      );
      set({ segment, duration: segment.duration });
      if (!get().yLockActive && segment.channels.length > 0) {
        get().lockChannelYFromSegment(segment);
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setZonesLocal: (zones, pushToHistory = true) => {
    const state = get();
    set({
      zones,
      zoneHistory: pushToHistory
        ? pushHistory(state.zoneHistory, zones)
        : state.zoneHistory,
    });
  },

  addZone: async (zoneData) => {
    const created = await api.createZone(zoneData);
    const next = [...get().zones, created];
    get().setZonesLocal(next);
    set({ zones: next, selectedZoneId: created.id });
  },

  updateZone: async (id, updates) => {
    const updated = await api.updateZone(id, updates);
    const next = get().zones.map((z) => (z.id === id ? updated : z));
    get().setZonesLocal(next);
    set({ zones: next });
  },

  deleteZone: async (id) => {
    await api.deleteZone(id);
    const next = get().zones.filter((z) => z.id !== id);
    get().setZonesLocal(next);
    set({
      zones: next,
      selectedZoneId: get().selectedZoneId === id ? null : get().selectedZoneId,
    });
  },

  deleteAllZones: async () => {
    await syncZones([]);
    get().setZonesLocal([], true);
    set({ zones: [], selectedZoneId: null });
  },

  undoZones: async () => {
    const undone = undoHistory(get().zoneHistory);
    if (!undone) return;
    const synced = await syncZones(undone.present);
    set({ zones: synced, zoneHistory: undone });
  },

  redoZones: async () => {
    const redone = redoHistory(get().zoneHistory);
    if (!redone) return;
    const synced = await syncZones(redone.present);
    set({ zones: synced, zoneHistory: redone });
  },

  applyFilters: async (settings) => {
    const state = await api.applyFilters(settings);
    get().clearChannelYLock();
    set({ appliedFilters: state.applied_filters });
    await get().fetchSegment(1000);
  },

  resetFilters: async () => {
    const state = await api.resetFilters();
    get().clearChannelYLock();
    set({
      appliedFilters: state.applied_filters,
    });
    await get().fetchSegment(1000);
  },

  saveProject: async () => {
    const result = await api.saveProject();
    return result.path;
  },

  loadProject: async (path) => {
    const { fileInfo, duration } = get();
    const result = await api.loadProject(path);
    const service = result.service_channels ?? [];
    if (fileInfo) {
      await api.selectChannels(
        result.selected_channels,
        service,
        0,
        duration > 0 ? duration : null,
      );
    }
    set({
      zones: result.zones,
      zoneHistory: createHistory(result.zones),
      zoneOnAllChannels: result.zone_on_all_channels,
      selectedChannels: result.selected_channels,
      serviceChannels: service,
    });
    await syncZones(result.zones);
    if (fileInfo && result.selected_channels.length > 0) {
      await get().fetchSegment(1000);
    }
  },
}));
