"""EEG filter pipeline using MNE."""

from __future__ import annotations

from typing import TYPE_CHECKING

from Source.App.models.session import FilterSettings

if TYPE_CHECKING:
    import mne


def apply_filters(raw: mne.io.BaseRaw, settings: FilterSettings) -> mne.io.BaseRaw:
    """Apply configured filters to a copy of raw data."""
    filtered = raw.copy()
    if settings.highpass is not None:
        filtered.filter(l_freq=settings.highpass, h_freq=None, verbose=False)
    if settings.lowpass is not None:
        filtered.filter(l_freq=None, h_freq=settings.lowpass, verbose=False)
    if settings.notch is not None:
        filtered.notch_filter(freqs=settings.notch, verbose=False)
    return filtered
