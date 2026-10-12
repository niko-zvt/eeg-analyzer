import { useEffect } from "react";
import { useLocaleStore } from "@/store/locale";

/** Sync locale to Electron main process (native menu) on mount and change. */
export function useLocaleSync(): void {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    void window.electronAPI?.setLocale?.(locale);
  }, [locale]);
}
