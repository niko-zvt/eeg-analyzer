import { useSessionStore } from "@/store/session";
import { useT } from "@/store/locale";

export function ChannelPageSlider() {
  const t = useT();
  const fileInfo = useSessionStore((s) => s.fileInfo);
  const selectedChannels = useSessionStore((s) => s.selectedChannels);
  const channelsPerPage = useSessionStore((s) => s.channelsPerPage);
  const channelPage = useSessionStore((s) => s.channelPage);
  const setChannelPage = useSessionStore((s) => s.setChannelPage);

  const totalChannels = selectedChannels.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalChannels / Math.max(1, channelsPerPage)),
  );

  if (!fileInfo || totalPages <= 1) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-border bg-[#252525] px-3 py-1.5">
      <span className="shrink-0 text-xs text-muted">{t.channelPageIndicator}</span>
      <input
        type="range"
        min={0}
        max={totalPages - 1}
        step={1}
        value={channelPage}
        onChange={(e) => setChannelPage(Number(e.target.value))}
        className="min-w-0 flex-1 accent-accent"
        aria-label={t.channelPageIndicator}
      />
      <span className="shrink-0 tabular-nums text-xs text-gray-300">
        {channelPage + 1}/{totalPages}
      </span>
    </div>
  );
}
