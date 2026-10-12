import { useMemo, useState } from "react";
import type { SpectrumAnalysisResponse, ZoneSpectrum } from "@/api/types";
import { useT } from "@/store/locale";
import { ZONE_PALETTE } from "@/utils/zoneColors";
import {
  formatSpectrumValue,
  toDisplayCi,
  toDisplayValues,
  type SpectrumUnit,
} from "@/utils/spectrumUnits";
import { SpectrumChart, type SpectrumSeries } from "./SpectrumChart";

interface AnalysisResultsDialogProps {
  results: SpectrumAnalysisResponse;
  onClose: () => void;
}

function defaultSeriesId(zone: ZoneSpectrum): string {
  if (zone.grand_average) return "__avg__";
  return zone.channels[0]?.name ?? "";
}

function zoneSeriesOptions(zone: ZoneSpectrum): { id: string; label: string }[] {
  const options = zone.channels.map((ch) => ({ id: ch.name, label: ch.name }));
  if (zone.grand_average) {
    options.push({ id: "__avg__", label: "__grand__" });
  }
  return options;
}

function buildSeries(
  zone: ZoneSpectrum,
  seriesId: string,
  unit: SpectrumUnit,
  grandLabel: string,
  color: string,
): SpectrumSeries | null {
  if (seriesId === "__avg__" && zone.grand_average) {
    const ci = zone.grand_average_ci_low && zone.grand_average_ci_high
      ? toDisplayCi(zone.grand_average_ci_low, zone.grand_average_ci_high, unit)
      : null;
    return {
      id: "__avg__",
      label: grandLabel,
      color,
      frequencies: zone.frequencies,
      values: toDisplayValues(zone.grand_average, unit),
      ciLow: ci?.low,
      ciHigh: ci?.high,
    };
  }

  const ch = zone.channels.find((c) => c.name === seriesId);
  if (!ch) return null;
  const ci = toDisplayCi(ch.psd_ci_low, ch.psd_ci_high, unit);
  return {
    id: ch.name,
    label: ch.name,
    color,
    frequencies: zone.frequencies,
    values: toDisplayValues(ch.psd_uv2, unit),
    ciLow: ci.low,
    ciHigh: ci.high,
  };
}

function buildChartSeries(
  zone: ZoneSpectrum,
  seriesId: string,
  unit: SpectrumUnit,
  grandLabel: string,
): SpectrumSeries[] {
  if (seriesId === "__all__") {
    const all: SpectrumSeries[] = [];
    zone.channels.forEach((ch, idx) => {
      const s = buildSeries(zone, ch.name, unit, grandLabel, ZONE_PALETTE[idx % ZONE_PALETTE.length]);
      if (s) all.push(s);
    });
    if (zone.grand_average) {
      const s = buildSeries(zone, "__avg__", unit, grandLabel, "#ffffff");
      if (s) all.push({ ...s, dashed: true });
    }
    return all;
  }

  const color = seriesId === "__avg__" ? "#ffffff" : ZONE_PALETTE[0];
  const s = buildSeries(zone, seriesId, unit, grandLabel, color);
  return s ? [s] : [];
}

interface SpectrumTableSource {
  psd_uv2: number[];
  psd_ci_low: number[];
  psd_ci_high: number[];
}

function resolveTableSource(
  zone: ZoneSpectrum,
  seriesId: string,
): SpectrumTableSource | null {
  if (seriesId === "__avg__" && zone.grand_average) {
    if (!zone.grand_average_ci_low || !zone.grand_average_ci_high) return null;
    return {
      psd_uv2: zone.grand_average,
      psd_ci_low: zone.grand_average_ci_low,
      psd_ci_high: zone.grand_average_ci_high,
    };
  }
  const ch = zone.channels.find((c) => c.name === seriesId);
  if (!ch) return null;
  return {
    psd_uv2: ch.psd_uv2,
    psd_ci_low: ch.psd_ci_low,
    psd_ci_high: ch.psd_ci_high,
  };
}

type TableRow = {
  freq: number;
  linear: number;
  log: number;
};

function tableRows(zone: ZoneSpectrum, seriesId: string): TableRow[] {
  const source = resolveTableSource(zone, seriesId);
  if (!source) return [];

  const db = toDisplayValues(source.psd_uv2, "db");

  return zone.frequencies.map((freq, i) => ({
    freq,
    linear: source.psd_uv2[i] ?? 0,
    log: db[i] ?? 0,
  }));
}

function formatTableForClipboard(
  rows: TableRow[],
  colFrequencyHz: string,
  colLinearPsd: string,
  colLogPsd: string,
): string {
  const header = [colFrequencyHz, colLinearPsd, colLogPsd].join("\t");
  const body = rows
    .map((row) =>
      [
        row.freq.toFixed(2),
        formatSpectrumValue(row.linear, "linear"),
        formatSpectrumValue(row.log, "db"),
      ].join("\t"),
    )
    .join("\n");
  return `${header}\n${body}`;
}

async function copyTableToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function ZoneResultSection({
  zone,
  bandLabel,
}: {
  zone: ZoneSpectrum;
  bandLabel: string;
}) {
  const t = useT();
  const [unit, setUnit] = useState<SpectrumUnit>("linear");
  const [open, setOpen] = useState(true);
  const options = useMemo(() => zoneSeriesOptions(zone), [zone]);
  const [seriesId, setSeriesId] = useState(() => defaultSeriesId(zone));

  const chartSeries = useMemo(
    () => buildChartSeries(zone, seriesId, unit, t.grandAverage),
    [zone, seriesId, unit, t.grandAverage],
  );

  const rows = useMemo(() => tableRows(zone, seriesId), [zone, seriesId]);

  const yLabel = unit === "db" ? t.unitDb : t.unitLinear;

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-200 hover:bg-surface/60"
        onClick={() => setOpen(!open)}
      >
        <span>
          {zone.zone_name}{" "}
          <span className="text-xs font-normal text-muted">
            ({bandLabel} - {t.analysisEpochCount}: {zone.epoch_count})
          </span>
        </span>
        <span className="text-muted">{open ? "\u25BE" : "\u25B8"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              {t.analysisSeries}
              <select
                className="input-field w-auto min-w-[8rem]"
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
              >
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label === "__grand__" ? t.grandAverage : opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex rounded-md border border-border text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 ${unit === "linear" ? "bg-accent-muted text-white" : "text-muted hover:bg-surface/60"}`}
                onClick={() => setUnit("linear")}
              >
                {t.unitLinear}
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 ${unit === "db" ? "bg-accent-muted text-white" : "text-muted hover:bg-surface/60"}`}
                onClick={() => setUnit("db")}
              >
                {t.unitDb}
              </button>
            </div>
          </div>

          <SpectrumChart
            series={chartSeries}
            xLabel={t.colFrequency}
            yLabel={yLabel}
            height={220}
          />

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary px-2.5 py-1 text-xs"
              disabled={rows.length === 0}
              onClick={() =>
                void copyTableToClipboard(
                  formatTableForClipboard(
                    rows,
                    t.colFrequencyHz,
                    t.colLinearPsd,
                    t.colLogPsd,
                  ),
                )
              }
            >
              {t.copy}
            </button>
          </div>

          <div className="max-h-48 overflow-auto rounded border border-border">
            <table className="table-compact min-w-full w-max">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">{t.colFrequencyHz}</th>
                  <th className="whitespace-nowrap">{t.colLinearPsd}</th>
                  <th className="whitespace-nowrap">{t.colLogPsd}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.freq}>
                    <td className="whitespace-nowrap text-muted">
                      {row.freq.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatSpectrumValue(row.linear, "linear")}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatSpectrumValue(row.log, "db")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisResultsDialog({
  results,
  onClose,
}: AnalysisResultsDialogProps) {
  const t = useT();
  const bandLabel = `${results.fmin}-${results.fmax}${t.hz.trim()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel flex max-h-[90vh] w-full max-w-3xl flex-col shadow-xl">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="text-lg font-medium">{t.analysisResults}</div>
          <div className="text-xs text-muted">
            {t.analysisBandRange}: {bandLabel}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {results.zones.map((zone) => (
            <ZoneResultSection key={zone.zone_id} zone={zone} bandLabel={bandLabel} />
          ))}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
