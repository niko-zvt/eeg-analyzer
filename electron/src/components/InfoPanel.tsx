import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FileInfo } from "@/api/types";
import { useT } from "@/store/locale";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel w-full">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-200 hover:bg-surface/60"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="border-t border-border px-1 pb-2">{children}</div>}
    </div>
  );
}

interface InfoPanelProps {
  fileInfo: FileInfo | null;
  selectedChannels: string[];
  serviceChannels: string[];
}

export function InfoPanel({ fileInfo, selectedChannels, serviceChannels }: InfoPanelProps) {
  const t = useT();

  if (!fileInfo) {
    return (
      <p className="px-2 py-4 text-sm text-muted">{t.openForInfo}</p>
    );
  }

  const metaRows: [string, string][] = [
    [t.duration, `${formatDuration(fileInfo.duration)} (${fileInfo.duration.toFixed(2)}${t.sec})`],
    [t.sfreq, `${fileInfo.sfreq.toFixed(2)}${t.hz}`],
    [t.channelsCount, String(fileInfo.n_channels)],
  ];
  if (fileInfo.meas_date) metaRows.push([t.measDate, fileInfo.meas_date]);
  if (selectedChannels.length) {
    metaRows.push([t.mainChannels, selectedChannels.join(", ")]);
  }
  if (serviceChannels.length) {
    metaRows.push([t.serviceChannels, serviceChannels.join(", ")]);
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="panel w-full">
        <table className="table-compact min-w-full w-max">
          <thead>
            <tr>
              <th className="whitespace-nowrap">{t.colParam}</th>
              <th className="whitespace-nowrap">{t.colValue}</th>
            </tr>
          </thead>
          <tbody>
            {metaRows.map(([k, v]) => (
              <tr key={k}>
                <td className="whitespace-nowrap text-muted">{k}</td>
                <td className="whitespace-nowrap">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CollapsibleSection title={t.annotations} defaultOpen={false}>
        {fileInfo.annotations.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted">{t.none}</p>
        ) : (
          <table className="table-compact min-w-full w-max">
            <thead>
              <tr>
                <th className="whitespace-nowrap">{t.colAnnStart}</th>
                <th className="whitespace-nowrap">{t.colAnnDur}</th>
                <th className="whitespace-nowrap">{t.colAnnDesc}</th>
              </tr>
            </thead>
            <tbody>
              {fileInfo.annotations.slice(0, 50).map((ann, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{ann.onset.toFixed(2)}{t.sec}</td>
                  <td className="whitespace-nowrap">{ann.duration.toFixed(2)}{t.sec}</td>
                  <td className="whitespace-nowrap">{ann.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>
    </div>
  );
}
