import { RotateCcw, Maximize2 } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { useT } from "@/store/locale";

const AMP_OPTIONS = [
  { label: "0.1x", value: 0.1 },
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
  { label: "5x", value: 5 },
];

export function Toolbar() {
  const t = useT();
  const resetView = useSessionStore((s) => s.resetView);
  const showAll = useSessionStore((s) => s.showAll);
  const ampMultiplier = useSessionStore((s) => s.ampMultiplier);
  const setAmpMultiplier = useSessionStore((s) => s.setAmpMultiplier);
  const fileInfo = useSessionStore((s) => s.fileInfo);

  if (!fileInfo) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
      <button
        type="button"
        className="btn-icon"
        title={t.tipResetView}
        onClick={() => resetView()}
      >
        <RotateCcw size={18} />
      </button>
      <button
        type="button"
        className="btn-icon"
        title={t.tipShowAll}
        onClick={() => showAll()}
      >
        <Maximize2 size={18} />
      </button>

      <div className="flex-1" />

      <div className="mx-1 h-6 w-px bg-border" />

      <label className="text-xs text-muted">{t.scaleCoeff}</label>
      <select
        className="input-field w-24"
        value={ampMultiplier}
        onChange={(e) => void setAmpMultiplier(Number(e.target.value))}
      >
        {AMP_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
