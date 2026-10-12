import { LOCALES } from "@shared/i18n";
import { useLocaleStore, useT } from "@/store/locale";

export function LanguageSelector() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useT();

  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
      <span>{t.language}</span>
      <select
        className="input-field w-auto min-w-[7rem] py-1 text-xs"
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
      >
        {LOCALES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
