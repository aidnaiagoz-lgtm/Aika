"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, KeyRound, Package, Scissors, Table2, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";

type Mode = "manager" | "workshop" | "leader" | "staff";
type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const ITEMS: Record<Mode, Item[]> = {
  workshop: [
    { href: "/workshop", label: "Тапсырма", icon: Scissors, exact: true },
    { href: "/workshop/pay", label: "Айлық", icon: Wallet },
    { href: "/workshop/workers", label: "Қызметкер", icon: Users },
    { href: "/change-password", label: "Пароль", icon: KeyRound },
  ],
  manager: [
    { href: "/rating", label: "Рейтинг", icon: Trophy },
    { href: "/departments/sales/almaty", label: "Продажи", icon: Table2 },
    { href: "/orders", label: "Заказдар", icon: Package },
    { href: "/change-password", label: "Пароль", icon: KeyRound },
  ],
  leader: [
    { href: "/dashboard", label: "Басты", icon: Home, exact: true },
    { href: "/departments/sales/almaty", label: "Продажи", icon: Table2 },
    { href: "/workshop", label: "Цех", icon: Scissors },
    { href: "/managers", label: "Менеджер", icon: Users },
    { href: "/rating", label: "Рейтинг", icon: Trophy },
  ],
  staff: [
    { href: "/dashboard", label: "Басты", icon: Home, exact: true },
    { href: "/orders", label: "Заказдар", icon: Package },
    { href: "/rating", label: "Рейтинг", icon: Trophy },
  ],
};

/** Телефондағы төменгі мәзір (md-ден үлкен экранда — сол жақтағы Sidebar). */
export function MobileNav({ mode }: { mode: Mode }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Мәзір"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {ITEMS[mode].map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-accent" : "text-text-secondary"}`}
          >
            <Icon size={21} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
