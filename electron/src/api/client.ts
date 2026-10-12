import type {
  FilterSettings,
  OpenResponse,
  ProjectLoadResponse,
  SegmentResponse,
  SelectResponse,
  SessionState,
  SpectrumAnalysisResponse,
  Zone,
} from "./types";

let apiBase = "http://127.0.0.1:8756";

export async function initApiBase(): Promise<string> {
  if (window.electronAPI?.getApiBaseUrl) {
    apiBase = await window.electronAPI.getApiBaseUrl();
  }
  return apiBase;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        "Не удалось связаться с сервером анализа. Дождитесь запуска приложения или перезапустите его.",
      );
    }
    throw err;
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  getSession: () => request<SessionState>("/api/session"),
  openFile: (path: string) =>
    request<OpenResponse>("/api/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  selectChannels: (
    channels: string[],
    serviceChannels: string[],
    tmin: number,
    tmax: number | null,
  ) =>
    request<SelectResponse>("/api/select", {
      method: "POST",
      body: JSON.stringify({
        channels,
        service_channels: serviceChannels,
        tmin,
        tmax,
      }),
    }),
  getSegment: (t0: number, t1: number, width: number, amp?: number) => {
    const params = new URLSearchParams({
      t0: String(t0),
      t1: String(t1),
      width: String(width),
    });
    if (amp !== undefined) params.set("amp", String(amp));
    return request<SegmentResponse>(`/api/segment?${params}`);
  },
  setAmpMultiplier: (value: number) =>
    request<{ value: number }>("/api/amp", {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
  setZoneOnAllChannels: (enabled: boolean) =>
    request<{ enabled: boolean }>("/api/zone-mode", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  applyFilters: (settings: FilterSettings) =>
    request<SessionState>("/api/filters", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  resetFilters: () =>
    request<SessionState>("/api/filters/reset", { method: "POST" }),
  listZones: () => request<Zone[]>("/api/zones"),
  createZone: (zone: Omit<Zone, "id">) =>
    request<Zone>("/api/zones", {
      method: "POST",
      body: JSON.stringify(zone),
    }),
  updateZone: (id: string, updates: Partial<Zone>) =>
    request<Zone>(`/api/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteZone: (id: string) =>
    request<{ status: string }>(`/api/zones/${id}`, { method: "DELETE" }),
  replaceZones: (zones: Zone[]) =>
    request<Zone[]>("/api/zones", {
      method: "PUT",
      body: JSON.stringify(zones),
    }),
  saveProject: () =>
    request<{ path: string }>("/api/project/save", { method: "POST" }),
  loadProject: (path?: string | null) =>
    request<ProjectLoadResponse>("/api/project/load", {
      method: "POST",
      body: JSON.stringify({ path: path ?? null }),
    }),
  analyzeSpectrum: (fmin: number, fmax: number, zoneIds?: string[]) =>
    request<SpectrumAnalysisResponse>("/api/analysis/spectrum", {
      method: "POST",
      body: JSON.stringify({
        fmin,
        fmax,
        zone_ids: zoneIds ?? null,
      }),
    }),
};
