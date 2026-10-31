"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";

// §6: барлық бөлімнің стандартты құрылымы — Dashboard | Жұмыстар | Аналитика | Есептер.
// extraTabs — кейбір бөлімге ғана тән қосымша қойынды (мыс. CRM-дегі "Клиенттер").
export function DepartmentTabs({
  title,
  basePath,
  locale,
  extraTabs = [],
}: {
  title: string;
  basePath: string;
  locale: Locale;
  extraTabs?: { slug: string; label: string }[];
}) {
  const pathname = usePathname();
  const t = getDictionary(locale);

  const TABS = [
    { slug: "dashboard", label: t.departmentTabs.dashboard },
    ...extraTabs,
    { slug: "work", label: t.departmentTabs.work },
    { slug: "analytics", label: t.departmentTabs.analytics },
    { slug: "reports", label: t.departmentTabs.reports },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const href = `${basePath}/${tab.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.slug}
              href={href}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-b-2 border-accent text-accent"
                  : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
