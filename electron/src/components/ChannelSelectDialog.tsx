import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ChannelGroup } from "@/api/types";
import { useT } from "@/store/locale";

interface ChannelSelectDialogProps {
  groups: ChannelGroup[];
  duration: number;
  defaultSelected?: string[];
  defaultServiceSelected?: string[];
  loading?: boolean;
  onConfirm: (
    channels: string[],
    serviceChannels: string[],
    tmin: number,
    tmax: number,
    channelsPerPage: number,
  ) => void;
  onCancel: () => void;
}

type ChannelRole = "main" | "service" | null;

function channelRole(
  ch: string,
  main: Set<string>,
  service: Set<string>,
): ChannelRole {
  if (main.has(ch)) return "main";
  if (service.has(ch)) return "service";
  return null;
}

function roleClass(role: ChannelRole): string {
  if (role === "main") return "border border-accent/50 bg-accent/15";
  if (role === "service") return "border border-amber-500/50 bg-amber-500/15";
  return "border border-transparent hover:bg-surface/60";
}

export function ChannelSelectDialog({
  groups,
  duration,
  defaultSelected,
  defaultServiceSelected,
  loading = false,
  onConfirm,
  onCancel,
}: ChannelSelectDialogProps) {
  const t = useT();
  const allChannels = useMemo(
    () => groups.flatMap((g) => g.channels),
    [groups],
  );
  const [mainSelected, setMainSelected] = useState<Set<string>>(() => {
    const initial = new Set(defaultSelected?.length ? defaultSelected : []);
    for (const ch of defaultServiceSelected ?? []) {
      initial.delete(ch);
    }
    return initial;
  });
  const [serviceSelected, setServiceSelected] = useState<Set<string>>(
    () => new Set(defaultServiceSelected ?? []),
  );
  const [perPage, setPerPage] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;

  useEffect(() => {
    if (!loading) setSubmitting(false);
  }, [loading]);

  const toggleMain = (ch: string) => {
    setMainSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
    setServiceSelected((prev) => {
      if (!prev.has(ch)) return prev;
      const next = new Set(prev);
      next.delete(ch);
      return next;
    });
  };

  const toggleService = (ch: string) => {
    setServiceSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
    setMainSelected((prev) => {
      if (!prev.has(ch)) return prev;
      const next = new Set(prev);
      next.delete(ch);
      return next;
    });
  };

  const selectAll = () => {
    setMainSelected(new Set(allChannels));
    setServiceSelected(new Set());
  };

  const deselectAll = () => {
    setMainSelected(new Set());
    setServiceSelected(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl">
        <div className="border-b border-border px-4 py-3 text-lg font-medium">
          {t.channelSelectTitle}
        </div>
        <p className="border-b border-border px-4 py-2 text-xs text-muted">
          {t.channelSelectHint}
        </p>
        <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-accent/50 bg-accent/15" />
            {t.mainChannels}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-amber-500/50 bg-amber-500/15" />
            {t.serviceChannels}
          </span>
        </div>
        <div className="flex gap-2 border-b border-border px-4 py-2">
          <button type="button" className="btn-secondary text-xs" onClick={selectAll}>
            {t.selectAll}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={deselectAll}>
            {t.deselectAll}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {groups.map((group) => (
            <div key={group.type_name} className="mb-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
                {group.type_name}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.channels.map((ch) => {
                  const role = channelRole(ch, mainSelected, serviceSelected);
                  return (
                    <button
                      key={ch}
                      type="button"
                      className={`rounded px-2 py-1 text-left text-sm ${roleClass(role)}`}
                      onClick={() => toggleMain(ch)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleService(ch);
                      }}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3">
          <label className="block text-xs text-muted">
            {t.channelsPerPage}
            <input
              type="number"
              min={1}
              step={1}
              className="input-field mt-1"
              value={perPage}
              onChange={(e) => setPerPage(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            disabled={mainSelected.size === 0 || busy}
            aria-busy={busy}
            onClick={() => {
              if (busy || mainSelected.size === 0) return;
              setSubmitting(true);
              onConfirm(
                [...mainSelected],
                [...serviceSelected],
                0,
                duration,
                perPage,
              );
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t.loading : t.open}
          </button>
        </div>
      </div>
    </div>
  );
}
