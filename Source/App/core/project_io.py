"""Save and load zone annotations as JSON."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from Source.App.models.zone import Zone


def project_path_for_bdf(bdf_path: Path) -> Path:
    """Default sidecar JSON path next to the BDF file."""
    return bdf_path.with_suffix(".zones.json")


def save_zones(
    bdf_path: Path,
    zones: list[Zone],
    *,
    zone_on_all_channels: bool = True,
    selected_channels: list[str] | None = None,
    service_channels: list[str] | None = None,
) -> Path:
    """Persist zone markup to JSON."""
    out_path = project_path_for_bdf(bdf_path)
    payload: dict[str, Any] = {
        "version": 1,
        "source_file": str(bdf_path),
        "zone_on_all_channels": zone_on_all_channels,
        "selected_channels": selected_channels or [],
        "service_channels": service_channels or [],
        "zones": [z.to_dict() for z in zones],
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_path


def load_zones(bdf_path: Path) -> tuple[list[Zone], dict[str, Any]]:
    """Load zone markup if present."""
    path = project_path_for_bdf(bdf_path)
    if not path.exists():
        return [], {}
    data = json.loads(path.read_text(encoding="utf-8"))
    zones = [Zone.from_dict(item) for item in data.get("zones", [])]
    return zones, data
