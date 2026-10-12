"""EEG session service backed by existing Python core."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from Source.App.core.eeg_loader import (
    DisplayPyramid,
    EegLoader,
    FileInfo,
    channel_display_scale,
    dominant_display_unit,
)
from Source.App.core.filters import apply_filters
from Source.App.core.spectral import compute_zone_spectrum
from Source.App.core.project_io import load_zones, project_path_for_bdf, save_zones
from Source.App.models.session import AppSession, FilterSettings
from Source.App.models.zone import Zone
from server.schemas import (
    ChannelGroupSchema,
    ChannelSegmentSchema,
    FileInfoSchema,
    FilterSettingsSchema,
    OpenResponse,
    ProjectLoadResponse,
    ProjectSaveResponse,
    SegmentResponse,
    SessionStateResponse,
    ZoneSchema,
    SpectrumAnalysisRequest,
    SpectrumAnalysisResponse,
    ZoneSpectrumSchema,
    ChannelSpectrumSchema,
)


def _zone_to_schema(zone: Zone) -> ZoneSchema:
    return ZoneSchema(
        id=zone.id,
        name=zone.name,
        t_start=zone.t_start,
        t_end=zone.t_end,
        channel=zone.channel,
        epoch_mode=zone.epoch_mode.value,
        epoch_value=zone.epoch_value,
        color=zone.color,
        visible=zone.visible,
    )


def _zone_from_schema(schema: ZoneSchema) -> Zone:
    return Zone.from_dict(schema.model_dump())


def _file_info_to_schema(info: FileInfo) -> FileInfoSchema:
    return FileInfoSchema(
        file_path=str(info.file_path),
        file_name=info.file_path.name,
        duration=info.duration,
        sfreq=info.sfreq,
        n_channels=info.n_channels,
        ch_names=info.ch_names,
        ch_types=info.ch_types,
        meas_date=info.meas_date,
        annotations=[
            {"onset": a["onset"], "duration": a["duration"], "description": a["description"]}
            for a in info.annotations
        ],
    )


class EegService:
    """Singleton service holding session state."""

    def __init__(self) -> None:
        self._session = AppSession()
        self._file_info: FileInfo | None = None
        self._pyramid: DisplayPyramid | None = None
        self._global_y_range: tuple[float, float] | None = None
        self._pending_raw = None
        self._pending_groups: list[ChannelGroupSchema] = []

    def open_file(self, path: str) -> OpenResponse:
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"File not found: {path}")

        raw = EegLoader.load(file_path)
        groups = EegLoader.group_channels(raw)
        file_info = EegLoader.file_info(file_path, raw)
        saved_zones, project_data = load_zones(file_path)

        self._pending_raw = raw
        self._file_info = file_info
        self._pending_groups = [
            ChannelGroupSchema(type_name=g.type_name, channels=g.channels) for g in groups
        ]
        self._session = AppSession(file_path=file_path, raw=raw)
        self._pyramid = None
        self._global_y_range = None

        return OpenResponse(
            file_info=_file_info_to_schema(file_info),
            channel_groups=self._pending_groups,
            saved_zones=[_zone_to_schema(z) for z in saved_zones],
            zone_on_all_channels=project_data.get("zone_on_all_channels", True),
            selected_channels=project_data.get("selected_channels", []),
            service_channels=project_data.get("service_channels", []),
        )

    def select_channels(
        self,
        channels: list[str],
        *,
        service_channels: list[str] | None = None,
        tmin: float = 0.0,
        tmax: float | None = None,
    ) -> None:
        if self._session.raw is None:
            raise RuntimeError("No file opened")

        raw = self._session.raw
        duration = float(raw.times[-1])
        tmax = duration if tmax is None else min(tmax, duration)
        tmin = max(0.0, tmin)
        service = service_channels or []

        cropped = raw.copy().crop(tmin=tmin, tmax=tmax, include_tmax=True)
        self._session.display_raw = cropped
        self._session.selected_channels = channels
        self._session.service_channels = service
        self._session.tmin = tmin
        self._session.tmax = tmax
        all_channels = channels + service
        self._pyramid = EegLoader.build_pyramid(cropped, all_channels)
        self._global_y_range = None
        self._recompute_global_y_range()

    def get_session_state(self) -> SessionStateResponse:
        if self._file_info is None:
            return SessionStateResponse(loaded=False)

        return SessionStateResponse(
            loaded=True,
            file_info=_file_info_to_schema(self._file_info),
            selected_channels=self._session.selected_channels,
            service_channels=self._session.service_channels,
            duration=self._session.duration,
            zones=[_zone_to_schema(z) for z in self._session.zones],
            zone_on_all_channels=self._session.zone_on_all_channels,
            amp_multiplier=self._session.amp_multiplier,
            applied_filters=FilterSettingsSchema(
                highpass=self._session.applied_filters.highpass,
                lowpass=self._session.applied_filters.lowpass,
                notch=self._session.applied_filters.notch,
            ),
        )

    def set_amp_multiplier(self, value: float) -> None:
        self._session.amp_multiplier = max(value, 1e-6)

    def set_zone_on_all_channels(self, enabled: bool) -> None:
        self._session.zone_on_all_channels = enabled

    def _display_scale(self) -> tuple[float, str]:
        if self._session.display_raw is None:
            return 1.0, "a.u."
        return dominant_display_unit(
            self._session.display_raw,
            self._session.selected_channels,
        )

    def get_segment(
        self,
        t0: float,
        t1: float,
        *,
        width: int = 1000,
        amp_multiplier: float | None = None,
    ) -> SegmentResponse:
        if self._pyramid is None:
            raise RuntimeError("No data loaded")

        amp = amp_multiplier if amp_multiplier is not None else self._session.amp_multiplier
        unit_scale, y_unit = self._display_scale()
        raw = self._session.display_raw

        data, times = self._pyramid.get_segment(t0, t1, pixels_wide=max(width, 100))
        if times.size == 0:
            return SegmentResponse(
                times=[],
                channels=[],
                y_min=0.0,
                y_max=1.0,
                y_unit=y_unit,
                duration=self._pyramid.duration,
            )

        times_list = times.tolist()
        channel_segments = []
        global_y_min = 0.0
        global_y_max = 1.0
        for i, name in enumerate(self._pyramid.channels):
            ch_unit = (
                channel_display_scale(raw, name)[1]
                if raw is not None
                else y_unit
            )
            ch_scale = (
                channel_display_scale(raw, name)[0]
                if raw is not None
                else unit_scale
            )
            base = data[i] * ch_scale
            ch_min = float(np.min(base)) if base.size else 0.0
            ch_max = float(np.max(base)) if base.size else 1.0
            y_abs = max(abs(ch_min), abs(ch_max), 1e-9)
            ch_y_min = -y_abs
            ch_y_max = y_abs
            scaled = base * amp
            if i == 0:
                global_y_min = ch_y_min
                global_y_max = ch_y_max
            else:
                global_y_min = min(global_y_min, ch_y_min)
                global_y_max = max(global_y_max, ch_y_max)
            channel_segments.append(
                ChannelSegmentSchema(
                    name=name,
                    data=scaled.tolist(),
                    unit=ch_unit,
                    y_min=ch_y_min,
                    y_max=ch_y_max,
                )
            )

        return SegmentResponse(
            times=times_list,
            channels=channel_segments,
            y_min=global_y_min,
            y_max=global_y_max,
            y_unit=y_unit,
            duration=self._pyramid.duration,
        )

    def _recompute_global_y_range(self) -> None:
        if self._pyramid is None:
            self._global_y_range = None
            return

        data, _ = self._pyramid.get_segment(
            0.0,
            self._pyramid.duration,
            pixels_wide=512,
        )
        if data.size == 0:
            self._global_y_range = None
            return

        ymin = float(np.min(data))
        ymax = float(np.max(data))
        if not math.isfinite(ymin) or not math.isfinite(ymax):
            self._global_y_range = None
            return
        if ymax - ymin < 1e-6:
            ymin -= 1.0
            ymax += 1.0
        self._global_y_range = (ymin, ymax)

    def apply_filters(self, settings: FilterSettingsSchema) -> None:
        if self._session.raw is None:
            raise RuntimeError("No file opened")

        filter_settings = FilterSettings(
            highpass=settings.highpass,
            lowpass=settings.lowpass,
            notch=settings.notch,
        )
        if filter_settings.is_empty():
            raise ValueError("At least one filter must be set")

        base = self._session.raw.copy()
        if self._session.tmax is not None:
            base = base.crop(
                tmin=self._session.tmin,
                tmax=self._session.tmax,
                include_tmax=True,
            )
        filtered = apply_filters(base, filter_settings)
        self._session.display_raw = filtered
        self._session.applied_filters = filter_settings.copy()
        self._session.filter_settings = filter_settings.copy()
        self._rebuild_pyramid()

    def reset_filters(self) -> None:
        if self._session.raw is None:
            raise RuntimeError("No file opened")

        self._session.reset_filters()
        if self._session.tmax is not None:
            self._session.display_raw = self._session.raw.copy().crop(
                tmin=self._session.tmin,
                tmax=self._session.tmax,
                include_tmax=True,
            )
        self._session.applied_filters = FilterSettings()
        self._rebuild_pyramid()

    def _rebuild_pyramid(self) -> None:
        if self._session.display_raw is None:
            return
        all_channels = self._session.selected_channels + self._session.service_channels
        self._pyramid = EegLoader.build_pyramid(
            self._session.display_raw,
            all_channels,
        )
        self._global_y_range = None
        self._recompute_global_y_range()

    def list_zones(self) -> list[ZoneSchema]:
        return [_zone_to_schema(z) for z in self._session.zones]

    def add_zone(self, zone_data: dict) -> ZoneSchema:
        zone = Zone.from_dict(zone_data)
        self._session.zones.append(zone)
        return _zone_to_schema(zone)

    def update_zone(self, zone_id: str, updates: dict) -> ZoneSchema:
        for i, zone in enumerate(self._session.zones):
            if zone.id == zone_id:
                data = zone.to_dict()
                data.update(updates)
                updated = Zone.from_dict(data)
                self._session.zones[i] = updated
                return _zone_to_schema(updated)
        raise KeyError(f"Zone not found: {zone_id}")

    def delete_zone(self, zone_id: str) -> None:
        before = len(self._session.zones)
        self._session.zones = [z for z in self._session.zones if z.id != zone_id]
        if len(self._session.zones) == before:
            raise KeyError(f"Zone not found: {zone_id}")

    def set_zones(self, zones: list[ZoneSchema]) -> None:
        self._session.zones = [_zone_from_schema(z) for z in zones]

    def save_project(self) -> ProjectSaveResponse:
        if self._session.file_path is None:
            raise RuntimeError("No file opened")
        path = save_zones(
            self._session.file_path,
            self._session.zones,
            zone_on_all_channels=self._session.zone_on_all_channels,
            selected_channels=self._session.selected_channels,
            service_channels=self._session.service_channels,
        )
        return ProjectSaveResponse(path=str(path))

    def analyze_spectrum(self, request: SpectrumAnalysisRequest) -> SpectrumAnalysisResponse:
        if self._session.display_raw is None:
            raise RuntimeError("No data loaded")

        if request.fmax <= request.fmin:
            raise ValueError("fmax must be greater than fmin")

        zones = self._session.zones
        if request.zone_ids:
            zone_id_set = set(request.zone_ids)
            zones = [z for z in zones if z.id in zone_id_set]
            if not zones:
                raise ValueError("No matching zones found")

        if not zones:
            raise ValueError("No zones defined")

        raw = self._session.display_raw
        selected = self._session.selected_channels
        results: list[ZoneSpectrumSchema] = []

        for zone in zones:
            result = compute_zone_spectrum(
                raw,
                zone,
                selected,
                fmin=request.fmin,
                fmax=request.fmax,
            )
            results.append(
                ZoneSpectrumSchema(
                    zone_id=result.zone_id,
                    zone_name=result.zone_name,
                    epoch_count=result.epoch_count,
                    frequencies=result.frequencies,
                    channels=[
                        ChannelSpectrumSchema(
                            name=ch.name,
                            psd_uv2=ch.psd_uv2,
                            psd_ci_low=ch.psd_ci_low,
                            psd_ci_high=ch.psd_ci_high,
                        )
                        for ch in result.channels
                    ],
                    grand_average=result.grand_average,
                    grand_average_ci_low=result.grand_average_ci_low,
                    grand_average_ci_high=result.grand_average_ci_high,
                )
            )

        return SpectrumAnalysisResponse(
            fmin=request.fmin,
            fmax=request.fmax,
            zones=results,
        )

    def load_project(self, path: str | None = None) -> ProjectLoadResponse:
        if self._session.file_path is None and path is None:
            raise RuntimeError("No file opened")

        project_path = Path(path) if path else project_path_for_bdf(self._session.file_path)
        if not project_path.is_file():
            raise FileNotFoundError(f"Project not found: {project_path}")

        data = json.loads(project_path.read_text(encoding="utf-8"))
        zones = [Zone.from_dict(item) for item in data.get("zones", [])]
        self._session.zones = zones
        self._session.zone_on_all_channels = data.get("zone_on_all_channels", True)
        selected = data.get("selected_channels", self._session.selected_channels)
        service = data.get("service_channels", self._session.service_channels)
        self._session.selected_channels = selected
        self._session.service_channels = service

        return ProjectLoadResponse(
            path=str(project_path),
            zones=[_zone_to_schema(z) for z in zones],
            zone_on_all_channels=self._session.zone_on_all_channels,
            selected_channels=selected,
            service_channels=service,
        )


_service: EegService | None = None


def get_service() -> EegService:
    global _service
    if _service is None:
        _service = EegService()
    return _service
