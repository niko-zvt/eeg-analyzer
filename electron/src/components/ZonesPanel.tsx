import { useRef, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Layers, Plus, Trash2 } from "lucide-react";
import type { Zone } from "@/api/types";
import { useSessionStore } from "@/store/session";
import { useT } from "@/store/locale";
import { computeEpochCount } from "@/utils/epochs";
import { normalizeZoneColor } from "@/utils/zoneColors";

interface ZonesPanelProps {
  onAddZone: () => void;
  onEditZone: (zone: Zone) => void;
  onAnalyze: () => void;
  analyzeDisabled?: boolean;
}

function isZoneVisible(zone: Zone): boolean {
  return zone.visible !== false;
}

export function ZonesPanel({
  onAddZone,
  onEditZone,
  onAnalyze,
  analyzeDisabled = false,
}: ZonesPanelProps) {
  const t = useT();
  const zones = useSessionStore((s) => s.zones);
  const selectedZoneId = useSessionStore((s) => s.selectedZoneId);
  const zoneOnAllChannels = useSessionStore((s) => s.zoneOnAllChannels);
  const setSelectedZoneId = useSessionStore((s) => s.setSelectedZoneId);
  const setZoneOnAllChannels = useSessionStore((s) => s.setZoneOnAllChannels);
  const deleteAllZones = useSessionStore((s) => s.deleteAllZones);
  const deleteZone = useSessionStore((s) => s.deleteZone);
  const updateZone = useSessionStore((s) => s.updateZone);
  const [open, setOpen] = useState(true);
  const colorInputs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="panel flex min-h-0 min-w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left text-sm font-medium text-gray-200 hover:text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{t.zonesSection}</span>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={`btn-icon-sm ${zoneOnAllChannels ? "btn-icon-sm-active" : ""}`}
            title={t.tipAllChannels}
            onClick={() => void setZoneOnAllChannels(!zoneOnAllChannels)}
          >
            <Layers size={14} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title={t.tipAddZone}
            onClick={onAddZone}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title={t.tipDeleteAllZones}
            disabled={zones.length === 0}
            onClick={() => void deleteAllZones()}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="btn-secondary px-2.5 py-1 text-xs"
            disabled={zones.length === 0 || analyzeDisabled}
            onClick={onAnalyze}
          >
            {t.analysis}
          </button>
        </div>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto border-t border-border px-1 pb-2">
          {zones.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">{t.none}</p>
          ) : (
            <table className="table-compact min-w-full w-max">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th className="w-8" />
                  <th>{t.colZoneName}</th>
                  <th>{t.colZoneStart}</th>
                  <th>{t.colZoneEnd}</th>
                  <th>{t.colEpochCount}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => {
                  const color = normalizeZoneColor(zone.color);
                  const selected = zone.id === selectedZoneId;
                  const visible = isZoneVisible(zone);
                  return (
                    <tr
                      key={zone.id}
                      className={`cursor-pointer ${selected ? "bg-accent-muted/20" : "hover:bg-surface/40"} ${!visible ? "opacity-60" : ""}`}
                      onClick={() => setSelectedZoneId(zone.id)}
                      onDoubleClick={() => onEditZone(zone)}
                    >
                      <td className="w-8">
                        <button
                          type="button"
                          className="h-5 w-5 rounded border border-border"
                          style={{ backgroundColor: color }}
                          title={t.zoneColor}
                          onClick={(e) => {
                            e.stopPropagation();
                            colorInputs.current[zone.id]?.click();
                          }}
                        />
                        <input
                          ref={(el) => {
                            colorInputs.current[zone.id] = el;
                          }}
                          type="color"
                          className="sr-only"
                          value={color}
                          onChange={(e) => {
                            void updateZone(zone.id, { color: e.target.value });
                          }}
                        />
                      </td>
                      <td className="w-8">
                        <button
                          type="button"
                          className="btn-icon-sm"
                          title={visible ? t.tipHideZone : t.tipShowZone}
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateZone(zone.id, { visible: !visible });
                          }}
                        >
                          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </td>
                      <td>{zone.name}</td>
                      <td className="whitespace-nowrap text-muted">
                        {zone.t_start.toFixed(2)}
                        {t.sec}
                      </td>
                      <td className="whitespace-nowrap text-muted">
                        {zone.t_end.toFixed(2)}
                        {t.sec}
                      </td>
                      <td className="text-muted">{computeEpochCount(zone)}</td>
                      <td className="w-8">
                        <button
                          type="button"
                          className="btn-icon-sm text-red-400 hover:text-red-300"
                          title={t.tipDeleteZone}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteZone(zone.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
