import { getDictionary, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export function AccessDenied({ message, locale = DEFAULT_LOCALE }: { message?: string; locale?: Locale }) {
  const resolved = message ?? getDictionary(locale).accessDenied.message;
  return (
    <div className="shadow-card rounded-card bg-surface p-8 text-center text-sm text-text-secondary">{resolved}</div>
  );
}
