import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/store/locale";

export type RhythmPreset = "delta" | "theta" | "alpha" | "beta" | "gamma" | "custom";

const PRESETS: Record<Exclude<RhythmPreset, "custom">, { fmin: number; fmax: number }> = {
  delta: { fmin: 0.5, fmax: 4 },
  theta: { fmin: 4, fmax: 8 },
  alpha: { fmin: 8, fmax: 13 },
  beta: { fmin: 13, fmax: 30 },
  gamma: { fmin: 30, fmax: 50 },
};

interface AnalysisConfigDialogProps {
  loading?: boolean;
  onCancel: () => void;
  onRun: (fmin: number, fmax: number) => void;
}

export function AnalysisConfigDialog({
  loading = false,
  onCancel,
  onRun,
}: AnalysisConfigDialogProps) {
  const t = useT();
  const [preset, setPreset] = useState<RhythmPreset>("alpha");
  const [customFmin, setCustomFmin] = useState(10);
  const [customFmax, setCustomFmax] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;

  useEffect(() => {
    if (!loading) setSubmitting(false);
  }, [loading]);

  const presetOptions: { id: RhythmPreset; label: string }[] = [
    { id: "delta", label: t.rhythmDelta },
    { id: "theta", label: t.rhythmTheta },
    { id: "alpha", label: t.rhythmAlpha },
    { id: "beta", label: t.rhythmBeta },
    { id: "gamma", label: t.rhythmGamma },
    { id: "custom", label: t.rhythmCustom },
  ];

  const handleRun = () => {
    if (busy) return;
    const range =
      preset === "custom" ? { fmin: customFmin, fmax: customFmax } : PRESETS[preset];
    if (range.fmax <= range.fmin) return;
    setSubmitting(true);
    onRun(range.fmin, range.fmax);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-md shadow-xl">
        <div className="border-b border-border px-4 py-3 text-lg font-medium">
          {t.analysisTitle}
        </div>
        <div className="space-y-2 px-4 py-4">
          {presetOptions.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                preset === opt.id
                  ? "border-accent bg-accent/10 text-gray-100"
                  : "border-border text-gray-300 hover:bg-surface/60"
              }`}
            >
              <input
                type="radio"
                name="rhythm"
                className="accent-accent"
                checked={preset === opt.id}
                onChange={() => setPreset(opt.id)}
                disabled={busy}
              />
              {opt.label}
            </label>
          ))}
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block text-xs text-muted">
                {t.customFmin}
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="input-field mt-1"
                  value={customFmin}
                  disabled={busy}
                  onChange={(e) => setCustomFmin(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block text-xs text-muted">
                {t.customFmax}
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="input-field mt-1"
                  value={customFmax}
                  disabled={busy}
                  onChange={(e) => setCustomFmax(Number(e.target.value) || 0)}
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            disabled={busy || (preset === "custom" && customFmax <= customFmin)}
            aria-busy={busy}
            onClick={handleRun}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t.loading : t.analysisRun}
          </button>
        </div>
      </div>
    </div>
  );
}
