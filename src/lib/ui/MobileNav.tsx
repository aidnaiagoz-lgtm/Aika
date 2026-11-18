"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import type { NavLabel } from "./Sidebar";
import { CheckCircle2, Home, Inbox, KeyRound, Package, Scissors, Table2, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";

type Mode = "manager" | "workshop" | "leader" | "staff";
type Item = { href: string; label: NavLabel; icon: LucideIcon; exact?: boolean };
const L = (kk: string, ru: string): NavLabel => ({ kk, ru });

const ITEMS: Record<Mode, Item[]> = {
  workshop: [
    { href: "/workshop/incoming", label: L("Түскен", "Входящие"), icon: Inbox },
    { href: "/workshop/sewing", label: L("Тігілуде", "В пошиве"), icon: Scissors },
    { href: "/workshop/ready", label: L("Дайын", "Готово"), icon: CheckCircle2 },
    { href: "/workshop/pay", label: L("Айлық", "Зарплата"), icon: Wallet },
    { href: "/workshop/workers", label: L("Қызметкер", "Сотрудники"), icon: Users },
  ],
  manager: [
    { href: "/rating", label: L("Рейтинг", "Рейтинг"), icon: Trophy },
    { href: "/departments/sales/almaty", label: L("Продажи", "Продажи"), icon: Table2 },
    { href: "/orders", label: L("Заказдар", "Заказы"), icon: Package },
    { href: "/change-password", label: L("Пароль", "Пароль"), icon: KeyRound },
  ],
  leader: [
    { href: "/dashboard", label: L("Басты", "Главная"), icon: Home, exact: true },
    { href: "/departments/sales/almaty", label: L("Продажи", "Продажи"), icon: Table2 },
    { href: "/workshop", label: L("Цех", "Цех"), icon: Scissors },
    { href: "/managers", label: L("Менеджер", "Менеджеры"), icon: Users },
    { href: "/rating", label: L("Рейтинг", "Рейтинг"), icon: Trophy },
  ],
  staff: [
    { href: "/dashboard", label: L("Басты", "Главная"), icon: Home, exact: true },
    { href: "/orders", label: L("Заказдар", "Заказы"), icon: Package },
    { href: "/rating", label: L("Рейтинг", "Рейтинг"), icon: Trophy },
  ],
};

/** Телефондағы төменгі мәзір (md-ден үлкен экранда — сол жақтағы Sidebar). */
export function MobileNav({ mode, locale }: { mode: Mode; locale: Locale }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={locale === "ru" ? "Меню" : "Мәзір"}
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
            {label[locale]}
          </Link>
        );
      })}
    </nav>
  );
}
