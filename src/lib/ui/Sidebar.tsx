"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  Home,
  Network,
  GraduationCap,
  Package,
  LayoutGrid,
  ListTodo,
  Bell,
  Bot,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Logo } from "./Logo";
import { getDictionary, DEPARTMENT_SLUGS, type Locale } from "@/lib/i18n";

export function Sidebar({
  userName,
  userRole,
  locale,
}: {
  userName: string;
  userRole: string;
  locale: Locale;
}) {
  const pathname = usePathname();
  const [departmentsOpen, setDepartmentsOpen] = useState<boolean>(pathname.startsWith("/departments"));
  const t = getDictionary(locale);

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.sidebar.nav.home, icon: Home },
    { href: "/orders", label: t.sidebar.nav.orders, icon: Package },
    { href: "/tasks", label: t.sidebar.nav.tasks, icon: ListTodo },
    { href: "/notifications", label: t.sidebar.nav.notifications, icon: Bell },
    { href: "/ai", label: t.sidebar.nav.ai, icon: Bot },
    { href: "/analytics", label: t.sidebar.nav.analytics, icon: BarChart3 },
    { href: "/settings", label: t.sidebar.nav.settings, icon: Settings },
  ];

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <div className="px-2 pb-6">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <NavLink href="/dashboard" label={t.sidebar.nav.home} icon={Home} active={pathname === "/dashboard"} />
        <NavLink
          href="/org-structure"
          label={t.sidebar.nav.orgStructure}
          icon={Network}
          active={pathname === "/org-structure"}
        />
        <NavLink
          href="/training"
          label={t.sidebar.nav.training}
          icon={GraduationCap}
          active={pathname === "/training"}
        />

        <button
          type="button"
          onClick={() => setDepartmentsOpen((v: boolean) => !v)}
          className={`flex items-center justify-between rounded-icon px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith("/departments")
              ? "bg-accent-tint text-accent"
              : "text-text-primary hover:bg-page-bg"
          }`}
        >
          <span className="flex items-center gap-3">
            <LayoutGrid size={18} />
            {t.sidebar.departments}
          </span>
          {departmentsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {departmentsOpen && (
          <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
            {DEPARTMENT_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={`/departments/${slug}`}
                className={`rounded-icon px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith(`/departments/${slug}`)
                    ? "font-semibold text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.sidebar.departmentNames[slug]}
              </Link>
            ))}
          </div>
        )}

        {NAV_ITEMS.slice(1).map((item) => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-card border border-border p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent">
          {userName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text-primary">{userRole}</div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
            {t.common.online}
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-icon px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-accent-tint text-accent" : "text-text-primary hover:bg-page-bg"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}
