"""Spectral (PSD) analysis for zones of interest."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

from Source.App.core.epoching import build_zone_epochs
from Source.App.models.zone import Zone

if TYPE_CHECKING:
    import mne

# MNE raw data is in volts; PSD is V^2/Hz -> scale to uV^2/Hz.
PSD_UV2_SCALE = 1e12


@dataclass(frozen=True)
class ChannelSpectrumResult:
    name: str
    psd_uv2: list[float]
    psd_ci_low: list[float]
    psd_ci_high: list[float]


@dataclass(frozen=True)
class ZoneSpectrumResult:
    zone_id: str
    zone_name: str
    epoch_count: int
    frequencies: list[float]
    channels: list[ChannelSpectrumResult]
    grand_average: list[float] | None
    grand_average_ci_low: list[float] | None
    grand_average_ci_high: list[float] | None


def _resolve_picks(raw: mne.io.BaseRaw, zone: Zone, selected_channels: list[str]) -> list[str]:
    if zone.channel:
        return [zone.channel] if zone.channel in raw.ch_names else []
    return [ch for ch in selected_channels if ch in raw.ch_names]


def _mean_sd_ci(data: np.ndarray, axis: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Mean and +/-1 SD band (MNE ci='sd' style) along axis."""
    mean = np.mean(data, axis=axis)
    n = data.shape[axis]
    if n > 1:
        std = np.std(data, axis=axis, ddof=1)
    else:
        std = np.zeros_like(mean)
    return mean, mean - std, mean + std


def compute_zone_spectrum(
    raw: mne.io.BaseRaw,
    zone: Zone,
    selected_channels: list[str],
    *,
    fmin: float,
    fmax: float,
) -> ZoneSpectrumResult:
    """Compute epoch-averaged PSD for a zone in the given frequency band."""
    if fmax <= fmin:
        raise ValueError("fmax must be greater than fmin")

    picks = _resolve_picks(raw, zone, selected_channels)
    if not picks:
        raise ValueError(f"No valid channels for zone '{zone.name}'")

    epochs = build_zone_epochs(raw, zone, picks=picks)
    if epochs is None or len(epochs.events) == 0:
        raise ValueError(f"Zone '{zone.name}' has no valid epochs")

    psd = epochs.compute_psd(fmin=fmin, fmax=fmax)
    frequencies = psd.freqs.astype(float)
    # shape: (n_epochs, n_channels, n_freqs)
    data = psd.get_data() * PSD_UV2_SCALE

    mean_psd, ci_low, ci_high = _mean_sd_ci(data, axis=0)

    channel_results = [
        ChannelSpectrumResult(
            name=name,
            psd_uv2=mean_psd[i].astype(float).tolist(),
            psd_ci_low=ci_low[i].astype(float).tolist(),
            psd_ci_high=ci_high[i].astype(float).tolist(),
        )
        for i, name in enumerate(epochs.ch_names)
    ]

    grand_average: list[float] | None = None
    grand_average_ci_low: list[float] | None = None
    grand_average_ci_high: list[float] | None = None
    if zone.channel is None and mean_psd.shape[0] > 0:
        g_mean, g_low, g_high = _mean_sd_ci(mean_psd, axis=0)
        grand_average = g_mean.astype(float).tolist()
        grand_average_ci_low = g_low.astype(float).tolist()
        grand_average_ci_high = g_high.astype(float).tolist()

    return ZoneSpectrumResult(
        zone_id=zone.id,
        zone_name=zone.name,
        epoch_count=len(epochs.events),
        frequencies=frequencies.tolist(),
        channels=channel_results,
        grand_average=grand_average,
        grand_average_ci_low=grand_average_ci_low,
        grand_average_ci_high=grand_average_ci_high,
    )
