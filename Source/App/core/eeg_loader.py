"""BDF/EDF loading and display pyramid for large recordings."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import mne
import numpy as np


@dataclass
class ChannelGroup:
    """Channels grouped by MNE channel type."""

    type_name: str
    channels: list[str]


@dataclass
class FileInfo:
    """Metadata extracted from a loaded recording file."""

    file_path: Path
    duration: float
    sfreq: float
    n_channels: int
    ch_names: list[str]
    ch_types: dict[str, str]
    meas_date: str | None
    annotations: list[dict[str, Any]]

    @classmethod
    def from_raw(cls, file_path: Path, raw: mne.io.BaseRaw) -> FileInfo:
        ch_types = {name: mne.channel_type(raw.info, idx) for idx, name in enumerate(raw.ch_names)}
        meas_date = None
        if raw.info.get("meas_date") is not None:
            meas_date = str(raw.info["meas_date"])

        annotations: list[dict[str, Any]] = []
        if raw.annotations is not None and len(raw.annotations) > 0:
            for onset, duration, description in zip(
                raw.annotations.onset,
                raw.annotations.duration,
                raw.annotations.description,
                strict=False,
            ):
                annotations.append(
                    {
                        "onset": float(onset),
                        "duration": float(duration),
                        "description": str(description),
                    }
                )

        return cls(
            file_path=file_path,
            duration=float(raw.times[-1]),
            sfreq=float(raw.info["sfreq"]),
            n_channels=len(raw.ch_names),
            ch_names=list(raw.ch_names),
            ch_types=ch_types,
            meas_date=meas_date,
            annotations=annotations,
        )


class DisplayPyramid:
    """
    Multi-resolution cache for fast plotting.

    Level 0 is full resolution; higher levels are downsampled by factor 2^level.
    """

    def __init__(self, raw: mne.io.BaseRaw, channels: list[str], max_levels: int = 6) -> None:
        self._raw = raw
        self._channels = channels
        self._sfreq = float(raw.info["sfreq"])
        self._duration = float(raw.times[-1])
        self._levels: dict[int, tuple[np.ndarray, np.ndarray]] = {}
        self._max_levels = max_levels
        self._build_level(0)

    @property
    def sfreq(self) -> float:
        return self._sfreq

    @property
    def duration(self) -> float:
        return self._duration

    @property
    def channels(self) -> list[str]:
        return self._channels

    def _build_level(self, level: int) -> None:
        if level in self._levels:
            return

        factor = max(1, 2**level)
        data, times = self._raw.get_data(picks=self._channels, return_times=True)
        if factor > 1:
            data = data[:, ::factor]
            times = times[::factor]

        self._levels[level] = (data, times)

    def choose_level(self, pixels_wide: int, time_span: float) -> int:
        """Pick pyramid level so we don't draw more points than pixels."""
        if pixels_wide <= 0 or time_span <= 0:
            return 0

        samples_in_view = time_span * self._sfreq
        target_ratio = max(1.0, samples_in_view / max(pixels_wide * 2, 1))
        level = int(np.floor(np.log2(target_ratio)))
        level = max(0, min(level, self._max_levels - 1))
        self._build_level(level)
        return level

    def get_segment(
        self,
        t_start: float,
        t_end: float,
        *,
        pixels_wide: int = 1000,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Return (data, times) for visible window at appropriate resolution."""
        t_start = max(0.0, t_start)
        t_end = min(self._duration, t_end)
        if t_end <= t_start:
            t_end = min(self._duration, t_start + 1.0)

        level = self.choose_level(pixels_wide, t_end - t_start)
        data, times = self._levels[level]

        mask = (times >= t_start) & (times <= t_end)
        return data[:, mask], times[mask]


def channel_display_scale(raw: mne.io.BaseRaw, ch_name: str) -> tuple[float, str]:
    """
    Scale factor and human-readable unit for plotting channel amplitudes.

    MNE stores EEG/EOG/etc. in volts; BDF viewers typically show microvolts.
    """
    idx = raw.ch_names.index(ch_name)
    ch_type = mne.channel_type(raw.info, idx)
    if ch_type in ("eeg", "eog", "ecg", "emg", "bio", "misc"):
        return 1e6, "\u00b5V"
    if ch_type in ("mag", "grad"):
        return 1e15, "fT"
    if ch_type == "stim":
        return 1.0, "V"
    return 1.0, "a.u."


def dominant_display_unit(raw: mne.io.BaseRaw, channels: list[str]) -> tuple[float, str]:
    """Pick display scale/unit shared by most selected channels."""
    if not channels:
        return 1.0, "a.u."
    counts: dict[tuple[float, str], int] = {}
    for name in channels:
        key = channel_display_scale(raw, name)
        counts[key] = counts.get(key, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0]


class EegLoader:
    """Load BDF/EDF files and prepare display pyramids."""

    @staticmethod
    def load(path: Path | str, *, preload: bool = True) -> mne.io.BaseRaw:
        """Load a recording by file extension (.bdf or .edf)."""
        file_path = Path(path)
        ext = file_path.suffix.lower()
        if ext == ".bdf":
            return mne.io.read_raw_bdf(str(file_path), preload=preload, verbose=False)
        if ext == ".edf":
            return mne.io.read_raw_edf(str(file_path), preload=preload, verbose=False)
        raise ValueError(f"Unsupported recording format: {ext or '(no extension)'}. Use .bdf or .edf.")

    @staticmethod
    def group_channels(raw: mne.io.BaseRaw) -> list[ChannelGroup]:
        groups: dict[str, list[str]] = {}
        for idx, name in enumerate(raw.ch_names):
            ch_type = mne.channel_type(raw.info, idx)
            label = ch_type.upper() if ch_type else "OTHER"
            groups.setdefault(label, []).append(name)
        return [ChannelGroup(type_name=k, channels=v) for k, v in sorted(groups.items())]

    @staticmethod
    def build_pyramid(raw: mne.io.BaseRaw, channels: list[str]) -> DisplayPyramid:
        return DisplayPyramid(raw, channels)

    @staticmethod
    def file_info(path: Path, raw: mne.io.BaseRaw) -> FileInfo:
        return FileInfo.from_raw(path, raw)
