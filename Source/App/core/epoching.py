"""Epoch computation for zones of interest."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

from Source.App.models.zone import EpochMode, Zone

if TYPE_CHECKING:
    import mne


@dataclass(frozen=True)
class EpochSlice:
    """Single epoch within a zone."""

    index: int
    t_start: float
    t_end: float
    duration: float


def compute_epochs(zone: Zone) -> list[EpochSlice]:
    """Split a zone into epochs, keeping a partial final epoch if needed."""
    zone_duration = zone.duration
    if zone_duration <= 0:
        return []

    if zone.epoch_mode == EpochMode.DURATION:
        epoch_len = max(zone.epoch_value, 1e-6)
        count = int(np.ceil(zone_duration / epoch_len))
    else:
        count = max(int(zone.epoch_value), 1)
        epoch_len = zone_duration / count

    epochs: list[EpochSlice] = []
    for i in range(count):
        start = zone.t_start + i * epoch_len
        end = min(start + epoch_len, zone.t_end)
        if end <= start:
            continue
        epochs.append(
            EpochSlice(
                index=i,
                t_start=start,
                t_end=end,
                duration=end - start,
            )
        )
    return epochs


def _epoch_length(zone: Zone) -> float:
    zone_duration = zone.duration
    if zone_duration <= 0:
        return 0.0
    if zone.epoch_mode == EpochMode.DURATION:
        return max(zone.epoch_value, 1e-6)
    count = max(int(zone.epoch_value), 1)
    return zone_duration / count


def crop_raw_to_zone(raw: mne.io.BaseRaw, zone: Zone) -> mne.io.BaseRaw:
    """Crop raw data to the zone time bounds."""
    cropped = raw.copy().crop(tmin=zone.t_start, tmax=zone.t_end, include_tmax=True)
    return cropped


def build_zone_epochs(
    raw: mne.io.BaseRaw,
    zone: Zone,
    *,
    picks: list[str] | None = None,
) -> mne.Epochs | None:
    """Build a single MNE Epochs object for a zone (all epoch slices)."""
    import mne

    if compute_epochs(zone) == []:
        return None

    epoch_len = _epoch_length(zone)
    if epoch_len <= 0:
        return None

    data_raw = crop_raw_to_zone(raw, zone)
    if picks:
        available = [p for p in picks if p in data_raw.ch_names]
        if not available:
            return None
        data_raw = data_raw.copy().pick(available)

    epochs = mne.make_fixed_length_epochs(
        data_raw,
        duration=epoch_len,
        overlap=0.0,
        preload=True,
    )
    if len(epochs.events) == 0:
        return None
    return epochs


def epochs_from_zone(
    raw: mne.io.BaseRaw,
    zone: Zone,
    *,
    picks: list[str] | None = None,
) -> list[mne.Epochs]:
    """Build per-slice MNE Epoch objects (legacy helper)."""
    import mne

    combined = build_zone_epochs(raw, zone, picks=picks)
    if combined is None:
        return []
    return [combined]
