"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ORDER_SUBNAV, orderSubActive } from "@/lib/ui/Sidebar";
import type { Locale } from "@/lib/i18n";

/** Телефонда сол жақ мәзір жоқ — «Заказдар» ішкі бөлімдері беттің үстінде (компьютерде жасырын). */
export function OrdersTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden" aria-label={locale === "ru" ? "Заказы" : "Заказдар"}>
      {ORDER_SUBNAV.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`whitespace-nowrap rounded-pill px-3.5 py-2 text-sm font-semibold ${
            orderSubActive(pathname, s.href) ? "bg-accent text-white" : "border border-border bg-surface text-text-secondary"
          }`}
        >
          {s.label[locale]}
        </Link>
      ))}
    </nav>
  );
}
