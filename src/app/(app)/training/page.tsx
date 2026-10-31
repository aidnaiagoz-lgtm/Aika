import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { DEPARTMENT_SLUGS, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function TrainingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t.training.pageTitle}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t.training.pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENT_SLUGS.map((slug) => (
          <Link
            key={slug}
            href={`/training/${slug}`}
            className="shadow-card flex items-center justify-between gap-3 rounded-card bg-surface p-4 transition-colors hover:bg-accent-tint"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                <GraduationCap size={18} />
              </span>
              <span className="text-sm font-semibold text-text-primary">{t.sidebar.departmentNames[slug]}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-text-secondary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
