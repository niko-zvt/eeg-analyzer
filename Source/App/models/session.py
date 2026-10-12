"""Application session state."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from Source.App.models.zone import Zone

if TYPE_CHECKING:
    import mne


@dataclass
class FilterSettings:
    """Optional filter parameters (not applied until user requests)."""

    highpass: float | None = None
    lowpass: float | None = None
    notch: float | None = None

    def is_empty(self) -> bool:
        return self.highpass is None and self.lowpass is None and self.notch is None

    def copy(self) -> FilterSettings:
        return FilterSettings(
            highpass=self.highpass,
            lowpass=self.lowpass,
            notch=self.notch,
        )


@dataclass
class AppSession:
    """Central state for the open recording."""

    file_path: Path | None = None
    raw: mne.io.BaseRaw | None = None
    display_raw: mne.io.BaseRaw | None = None
    selected_channels: list[str] = field(default_factory=list)
    service_channels: list[str] = field(default_factory=list)
    zones: list[Zone] = field(default_factory=list)
    zone_on_all_channels: bool = True
    amp_multiplier: float = 1.0
    filter_settings: FilterSettings = field(default_factory=FilterSettings)
    applied_filters: FilterSettings = field(default_factory=FilterSettings)
    tmin: float = 0.0
    tmax: float | None = None

    @property
    def duration(self) -> float:
        if self.display_raw is None:
            return 0.0
        return float(self.display_raw.times[-1])

    def reset_filters(self) -> None:
        self.applied_filters = FilterSettings()
        if self.raw is not None:
            self.display_raw = self.raw.copy()
