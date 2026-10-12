export interface FilterSettings {
  highpass: number | null;
  lowpass: number | null;
  notch: number | null;
}

export interface Zone {
  id: string;
  name: string;
  t_start: number;
  t_end: number;
  channel: string | null;
  epoch_mode: "duration" | "count";
  epoch_value: number;
  color: string;
  visible?: boolean;
}

export interface Annotation {
  onset: number;
  duration: number;
  description: string;
}

export interface ChannelGroup {
  type_name: string;
  channels: string[];
}

export interface FileInfo {
  file_path: string;
  file_name: string;
  duration: number;
  sfreq: number;
  n_channels: number;
  ch_names: string[];
  ch_types: Record<string, string>;
  meas_date: string | null;
  annotations: Annotation[];
}

export interface OpenResponse {
  file_info: FileInfo;
  channel_groups: ChannelGroup[];
  saved_zones: Zone[];
  zone_on_all_channels: boolean;
  selected_channels: string[];
  service_channels: string[];
}

export interface SelectResponse {
  duration: number;
  selected_channels: string[];
  service_channels: string[];
  zones: Zone[];
}

export interface ChannelSegment {
  name: string;
  data: number[];
  unit: string;
  y_min: number;
  y_max: number;
}

export interface SegmentResponse {
  times: number[];
  channels: ChannelSegment[];
  y_min: number;
  y_max: number;
  y_unit: string;
  duration: number;
}

export interface SessionState {
  loaded: boolean;
  file_info: FileInfo | null;
  selected_channels: string[];
  service_channels: string[];
  duration: number;
  zones: Zone[];
  zone_on_all_channels: boolean;
  amp_multiplier: number;
  applied_filters: FilterSettings;
}

export interface ProjectLoadResponse {
  path: string;
  zones: Zone[];
  zone_on_all_channels: boolean;
  selected_channels: string[];
  service_channels: string[];
}

export interface ChannelSpectrum {
  name: string;
  psd_uv2: number[];
  psd_ci_low: number[];
  psd_ci_high: number[];
}

export interface ZoneSpectrum {
  zone_id: string;
  zone_name: string;
  epoch_count: number;
  frequencies: number[];
  channels: ChannelSpectrum[];
  grand_average: number[] | null;
  grand_average_ci_low: number[] | null;
  grand_average_ci_high: number[] | null;
}

export interface SpectrumAnalysisResponse {
  fmin: number;
  fmax: number;
  zones: ZoneSpectrum[];
}
