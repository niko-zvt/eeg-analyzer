export type SpectrumUnit = "linear" | "db";

export function toDisplayValues(psdUv2: number[], unit: SpectrumUnit): number[] {
  if (unit === "linear") return psdUv2;
  return psdUv2.map((v) => (v > 0 ? 10 * Math.log10(v) : -120));
}

export function toDisplayCi(
  low: number[],
  high: number[],
  unit: SpectrumUnit,
): { low: number[]; high: number[] } {
  return {
    low: toDisplayValues(low, unit),
    high: toDisplayValues(high, unit),
  };
}

export function formatSpectrumValue(value: number, unit: SpectrumUnit): string {
  if (unit === "db") return value.toFixed(2);
  if (Math.abs(value) >= 1000) return value.toExponential(2);
  return value.toFixed(4);
}

