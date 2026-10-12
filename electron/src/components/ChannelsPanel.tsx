import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FileInfo } from "@/api/types";
import { useT } from "@/store/locale";

interface ChannelsPanelProps {
  fileInfo: FileInfo | null;
}

export function ChannelsPanel({ fileInfo }: ChannelsPanelProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (!fileInfo) return null;

  return (
    <div className="panel shrink-0 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-200 hover:bg-surface/60"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {t.channels}
      </button>
      {open && (
        <div className="border-t border-border px-1 pb-2">
          <table className="table-compact w-max min-w-full">
            <thead>
              <tr>
                <th>{t.colChannel}</th>
                <th>{t.colType}</th>
              </tr>
            </thead>
            <tbody>
              {fileInfo.ch_names.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="text-muted">{fileInfo.ch_types[name] ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
