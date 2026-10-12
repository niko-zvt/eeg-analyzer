import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Zone } from "@/api/types";
import { useSessionStore } from "@/store/session";
import { InfoPanel } from "./InfoPanel";
import { ZonesPanel } from "./ZonesPanel";
import { ChannelsPanel } from "./ChannelsPanel";
import { useT } from "@/store/locale";

interface ToolsPanelProps {
  onAddZone: () => void;
  onEditZone: (zone: Zone) => void;
  onAnalyze: () => void;
  analyzeDisabled?: boolean;
}

export function ToolsPanel({
  onAddZone,
  onEditZone,
  onAnalyze,
  analyzeDisabled,
}: ToolsPanelProps) {
  const t = useT();
  const fileInfo = useSessionStore((s) => s.fileInfo);
  const selectedChannels = useSessionStore((s) => s.selectedChannels);
  const serviceChannels = useSessionStore((s) => s.serviceChannels);
  const appliedFilters = useSessionStore((s) => s.appliedFilters);
  const applyFilters = useSessionStore((s) => s.applyFilters);
  const resetFilters = useSessionStore((s) => s.resetFilters);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [highpass, setHighpass] = useState(0);
  const [lowpass, setLowpass] = useState(0);
  const [notch, setNotch] = useState(0);

  const handleApply = () => {
    void applyFilters({
      highpass: highpass > 0 ? highpass : null,
      lowpass: lowpass > 0 ? lowpass : null,
      notch: notch > 0 ? notch : null,
    });
  };

  const handleReset = () => {
    setHighpass(0);
    setLowpass(0);
    setNotch(0);
    void resetFilters();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <ZonesPanel
          onAddZone={onAddZone}
          onEditZone={onEditZone}
          onAnalyze={onAnalyze}
          analyzeDisabled={analyzeDisabled}
        />

        <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 whitespace-nowrap border-b border-border px-3 py-2 text-sm font-medium text-gray-200">
            {t.info}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <InfoPanel
              fileInfo={fileInfo}
              selectedChannels={selectedChannels}
              serviceChannels={serviceChannels}
            />
          </div>
        </div>
      </div>

      <div className="panel shrink-0 overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-200 hover:bg-surface/60"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {filtersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t.filters}
        </button>
        {filtersOpen && (
          <div className="space-y-2 border-t border-border px-3 py-3">
            <label className="block text-xs text-muted">
              {t.highpass}
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-field mt-1"
                value={highpass || ""}
                placeholder={t.off}
                onChange={(e) => setHighpass(Number(e.target.value) || 0)}
              />
            </label>
            <label className="block text-xs text-muted">
              {t.lowpass}
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-field mt-1"
                value={lowpass || ""}
                placeholder={t.off}
                onChange={(e) => setLowpass(Number(e.target.value) || 0)}
              />
            </label>
            <label className="block text-xs text-muted">
              {t.notch}
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-field mt-1"
                value={notch || ""}
                placeholder={t.off}
                onChange={(e) => setNotch(Number(e.target.value) || 0)}
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-primary flex-1" onClick={handleApply}>
                {t.apply}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={handleReset}>
                {t.resetFilters}
              </button>
            </div>
            {(appliedFilters.highpass || appliedFilters.lowpass || appliedFilters.notch) && (
              <p className="text-xs text-accent">
                {[
                  appliedFilters.highpass && `HP ${appliedFilters.highpass}`,
                  appliedFilters.lowpass && `LP ${appliedFilters.lowpass}`,
                  appliedFilters.notch && `N ${appliedFilters.notch}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>

      <ChannelsPanel fileInfo={fileInfo} />
    </div>
  );
}
