import { Search, Bell, Maximize2, LogOut } from "lucide-react";
import { getDictionary, type Locale } from "@/lib/i18n";

export function Header({
  userName,
  userRole,
  unreadCount = 0,
  dateLabel,
  onLogout,
  locale,
  onSetLocale,
}: {
  userName: string;
  userRole: string;
  unreadCount?: number;
  dateLabel: string;
  onLogout?: () => void | Promise<void>;
  locale: Locale;
  onSetLocale?: (formData: FormData) => void | Promise<void>;
}) {
  const t = getDictionary(locale);
  const nextLocale: Locale = locale === "kk" ? "ru" : "kk";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-8 py-4">
      <div className="relative w-full max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="search"
          placeholder={t.header.searchPlaceholder}
          className="w-full rounded-pill bg-page-bg py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-pill bg-page-bg px-4 py-2 text-sm font-medium text-text-primary">{dateLabel}</div>

        {onSetLocale && (
          <form action={onSetLocale}>
            <input type="hidden" name="locale" value={nextLocale} />
            <button
              type="submit"
              aria-label={t.header.localeToggle}
              className="rounded-pill bg-page-bg px-3.5 py-2 text-xs font-bold tracking-wide text-text-primary hover:bg-border"
            >
              {t.header.localeToggle}
            </button>
          </form>
        )}

        <button
          type="button"
          aria-label={t.header.notifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-page-bg"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          aria-label={t.header.fullscreen}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-page-bg"
        >
          <Maximize2 size={18} />
        </button>

        <div className="flex items-center gap-2 pl-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent">
            {userName.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-text-primary">{userRole}</div>
            <div className="text-xs text-status-success">{t.common.online}</div>
          </div>
        </div>

        {onLogout && (
          <form action={onLogout}>
            <button
              type="submit"
              aria-label={t.header.logout}
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-page-bg"
            >
              <LogOut size={18} />
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
