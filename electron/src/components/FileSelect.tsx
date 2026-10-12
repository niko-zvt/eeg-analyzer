import { useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { useT } from "@/store/locale";

interface FileSelectProps {
  onBrowse: () => void | Promise<void>;
  loading?: boolean;
}

export function FileSelect({ onBrowse, loading }: FileSelectProps) {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;

  const handleBrowse = async () => {
    if (busy) return;
    setSubmitting(true);
    try {
      await onBrowse();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-4 pt-3">
        <LanguageSelector />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-100">{t.appTitle}</h1>
          <p className="mt-2 text-sm text-muted">{t.startupHint}</p>
        </div>
        <button
          type="button"
          className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
          onClick={() => void handleBrowse()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <FolderOpen size={20} />
          )}
          {busy ? t.loading : t.browse}
        </button>
      </div>
    </div>
  );
}
