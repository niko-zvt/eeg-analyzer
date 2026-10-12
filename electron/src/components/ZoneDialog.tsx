import { useCallback, useEffect, useState } from "react";
import type { Zone } from "@/api/types";
import { useT } from "@/store/locale";
import { nextZoneColor, normalizeZoneColor } from "@/utils/zoneColors";
import { nextZoneName } from "@/utils/zoneNames";

const ALL_CHANNELS_VALUE = "__all__";

interface ZoneDialogProps {
  zone?: Zone | null;
  zones: Zone[];
  maxTime: number;
  channels: string[];
  channelName?: string | null;
  allChannels?: boolean;
  onSave: (data: Omit<Zone, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

function initialChannel(
  allChannels: boolean,
  channelName: string | null | undefined,
  channels: string[],
  zoneChannel: string | null | undefined,
): string | null {
  if (zoneChannel !== undefined) return zoneChannel;
  if (allChannels) return null;
  return channelName ?? channels[0] ?? null;
}

export function ZoneDialog({
  zone,
  zones,
  maxTime,
  channels,
  channelName,
  allChannels = true,
  onSave,
  onCancel,
}: ZoneDialogProps) {
  const t = useT();
  const [name, setName] = useState(
    zone?.name ?? nextZoneName(zones, t.zoneNamePrefix),
  );
  const [tStart, setTStart] = useState(zone?.t_start ?? 0);
  const [tEnd, setTEnd] = useState(zone?.t_end ?? Math.min(10, maxTime));
  const [channel, setChannel] = useState<string | null>(() =>
    initialChannel(allChannels, channelName, channels, zone?.channel),
  );
  const [color, setColor] = useState(
    normalizeZoneColor(zone?.color ?? nextZoneColor(zones)),
  );
  const [epochMode, setEpochMode] = useState<"duration" | "count">(
    zone?.epoch_mode ?? "duration",
  );
  const [epochValue, setEpochValue] = useState(zone?.epoch_value ?? 10);

  const handleSave = useCallback(() => {
    onSave({
      id: zone?.id,
      name,
      t_start: Math.max(0, Math.min(tStart, maxTime)),
      t_end: Math.max(0, Math.min(tEnd, maxTime)),
      channel,
      epoch_mode: epochMode,
      epoch_value: epochValue,
      color,
    });
  }, [
    channel,
    color,
    epochMode,
    epochValue,
    maxTime,
    name,
    onSave,
    tEnd,
    tStart,
    zone?.id,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-md shadow-xl">
        <div className="border-b border-border px-4 py-3 text-lg font-medium">
          {t.zoneTitle}
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="block text-xs text-muted">
            {t.zoneName}
            <input
              className="input-field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted">
            {t.zoneColor}
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span className="text-sm text-gray-300">{color}</span>
            </div>
          </label>
          <label className="block text-xs text-muted">
            {t.channel}
            <select
              className="input-field mt-1"
              value={channel ?? ALL_CHANNELS_VALUE}
              onChange={(e) =>
                setChannel(
                  e.target.value === ALL_CHANNELS_VALUE ? null : e.target.value,
                )
              }
            >
              <option value={ALL_CHANNELS_VALUE}>{t.allChannels}</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">
              {t.start}
              <input
                type="number"
                min={0}
                max={maxTime}
                step={0.01}
                className="input-field mt-1"
                value={tStart}
                onChange={(e) => setTStart(Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-muted">
              {t.end}
              <input
                type="number"
                min={0}
                max={maxTime}
                step={0.01}
                className="input-field mt-1"
                value={tEnd}
                onChange={(e) => setTEnd(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="block text-xs text-muted">
            {t.epochMode}
            <select
              className="input-field mt-1"
              value={epochMode}
              onChange={(e) => setEpochMode(e.target.value as "duration" | "count")}
            >
              <option value="duration">{t.epochDuration}</option>
              <option value="count">{t.epochCount}</option>
            </select>
          </label>
          <label className="block text-xs text-muted">
            {epochMode === "duration" ? t.epochDurationField : t.epochCountField}
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="input-field mt-1"
              value={epochValue}
              onChange={(e) => setEpochValue(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
