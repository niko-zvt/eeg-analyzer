"""Zone of interest data model."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EpochMode(str, Enum):
    """How epochs are defined inside a zone."""

    DURATION = "duration"
    COUNT = "count"


DEFAULT_ZONE_COLOR = "#ffc800"


@dataclass
class Zone:
    """A time region of interest on one or all channels."""

    name: str
    t_start: float
    t_end: float
    channel: str | None = None
    epoch_mode: EpochMode = EpochMode.DURATION
    epoch_value: float = 10.0
    color: str = DEFAULT_ZONE_COLOR
    visible: bool = True
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    @property
    def duration(self) -> float:
        return max(0.0, self.t_end - self.t_start)

    def display_name(self, channel_suffix: str | None = None) -> str:
        if channel_suffix:
            return f"{self.name}_{channel_suffix}"
        return self.name

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "t_start": self.t_start,
            "t_end": self.t_end,
            "channel": self.channel,
            "epoch_mode": self.epoch_mode.value,
            "epoch_value": self.epoch_value,
            "color": self.color,
            "visible": self.visible,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Zone:
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data["name"],
            t_start=float(data["t_start"]),
            t_end=float(data["t_end"]),
            channel=data.get("channel"),
            epoch_mode=EpochMode(data.get("epoch_mode", EpochMode.DURATION.value)),
            epoch_value=float(data.get("epoch_value", 10.0)),
            color=str(data.get("color", DEFAULT_ZONE_COLOR)),
            visible=bool(data.get("visible", True)),
        )

    def copy(self) -> Zone:
        return Zone(
            id=self.id,
            name=self.name,
            t_start=self.t_start,
            t_end=self.t_end,
            channel=self.channel,
            epoch_mode=self.epoch_mode,
            epoch_value=self.epoch_value,
            color=self.color,
            visible=self.visible,
        )
