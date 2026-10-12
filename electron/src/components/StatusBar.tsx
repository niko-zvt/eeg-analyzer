import { LanguageSelector } from "./LanguageSelector";
import { useT } from "@/store/locale";

interface StatusBarProps {
  fileName: string | null;
  filePath: string | null;
}

export function StatusBar({ fileName, filePath }: StatusBarProps) {
  const t = useT();

  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-[#252525] px-3 py-1.5 text-xs text-muted">
      <span className="shrink-0 font-medium text-gray-300">
        {fileName ?? t.fileNotOpen}
      </span>
      {filePath && (
        <span className="min-w-0 flex-1 truncate" title={filePath}>
          {filePath}
        </span>
      )}
      <LanguageSelector />
    </footer>
  );
}
