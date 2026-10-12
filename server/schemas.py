"""Pydantic request/response models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class FilterSettingsSchema(BaseModel):
    highpass: float | None = None
    lowpass: float | None = None
    notch: float | None = None


class ZoneSchema(BaseModel):
    id: str
    name: str
    t_start: float
    t_end: float
    channel: str | None = None
    epoch_mode: Literal["duration", "count"] = "duration"
    epoch_value: float = 10.0
    color: str = "#ffc800"
    visible: bool = True


class AnnotationSchema(BaseModel):
    onset: float
    duration: float
    description: str


class ChannelGroupSchema(BaseModel):
    type_name: str
    channels: list[str]


class FileInfoSchema(BaseModel):
    file_path: str
    file_name: str
    duration: float
    sfreq: float
    n_channels: int
    ch_names: list[str]
    ch_types: dict[str, str]
    meas_date: str | None = None
    annotations: list[AnnotationSchema] = Field(default_factory=list)


class OpenResponse(BaseModel):
    file_info: FileInfoSchema
    channel_groups: list[ChannelGroupSchema]
    saved_zones: list[ZoneSchema] = Field(default_factory=list)
    zone_on_all_channels: bool = True
    selected_channels: list[str] = Field(default_factory=list)
    service_channels: list[str] = Field(default_factory=list)


class OpenRequest(BaseModel):
    path: str


class SelectRequest(BaseModel):
    channels: list[str]
    service_channels: list[str] = Field(default_factory=list)
    tmin: float = 0.0
    tmax: float | None = None


class SelectResponse(BaseModel):
    duration: float
    selected_channels: list[str]
    service_channels: list[str] = Field(default_factory=list)
    zones: list[ZoneSchema]


class ChannelSegmentSchema(BaseModel):
    name: str
    data: list[float]
    unit: str = "a.u."
    y_min: float = -1.0
    y_max: float = 1.0


class SegmentResponse(BaseModel):
    times: list[float]
    channels: list[ChannelSegmentSchema]
    y_min: float
    y_max: float
    y_unit: str = "a.u."
    duration: float


class SessionStateResponse(BaseModel):
    loaded: bool
    file_info: FileInfoSchema | None = None
    selected_channels: list[str] = Field(default_factory=list)
    service_channels: list[str] = Field(default_factory=list)
    duration: float = 0.0
    zones: list[ZoneSchema] = Field(default_factory=list)
    zone_on_all_channels: bool = True
    amp_multiplier: float = 1.0
    applied_filters: FilterSettingsSchema = Field(default_factory=FilterSettingsSchema)


class ZoneCreateRequest(BaseModel):
    name: str
    t_start: float
    t_end: float
    channel: str | None = None
    epoch_mode: Literal["duration", "count"] = "duration"
    epoch_value: float = 10.0
    color: str = "#ffc800"
    visible: bool = True


class ZoneUpdateRequest(BaseModel):
    name: str | None = None
    t_start: float | None = None
    t_end: float | None = None
    channel: str | None = None
    epoch_mode: Literal["duration", "count"] | None = None
    epoch_value: float | None = None
    color: str | None = None
    visible: bool | None = None


class ProjectLoadRequest(BaseModel):
    path: str | None = None


class ProjectSaveResponse(BaseModel):
    path: str


class ProjectLoadResponse(BaseModel):
    path: str
    zones: list[ZoneSchema]
    zone_on_all_channels: bool
    selected_channels: list[str]
    service_channels: list[str] = Field(default_factory=list)


class AmpMultiplierRequest(BaseModel):
    value: float


class ZoneOnAllChannelsRequest(BaseModel):
    enabled: bool


class ErrorResponse(BaseModel):
    detail: str


class SpectrumAnalysisRequest(BaseModel):
    fmin: float
    fmax: float
    zone_ids: list[str] | None = None


class ChannelSpectrumSchema(BaseModel):
    name: str
    psd_uv2: list[float]
    psd_ci_low: list[float]
    psd_ci_high: list[float]


class ZoneSpectrumSchema(BaseModel):
    zone_id: str
    zone_name: str
    epoch_count: int
    frequencies: list[float]
    channels: list[ChannelSpectrumSchema]
    grand_average: list[float] | None = None
    grand_average_ci_low: list[float] | None = None
    grand_average_ci_high: list[float] | None = None


class SpectrumAnalysisResponse(BaseModel):
    fmin: float
    fmax: float
    zones: list[ZoneSpectrumSchema]
