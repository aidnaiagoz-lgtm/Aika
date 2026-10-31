import type { Locale } from "@/lib/i18n";
import { tr } from "@/lib/tr";

// §38 — визуал Timeline. order.statusHistory-ден әр кезеңнің алғаш жеткен уақыты алынады.
function getSteps(locale: Locale): { status: string; label: string }[] {
  return [
    { status: "NEW", label: tr(locale, { kk: "Құрылды", ru: "Создан" }) },
    { status: "CONFIRMED", label: tr(locale, { kk: "Расталды", ru: "Подтверждён" }) },
    { status: "IN_PRODUCTION", label: tr(locale, { kk: "Өндірісте", ru: "В производстве" }) },
    { status: "READY", label: tr(locale, { kk: "Дайын", ru: "Готов" }) },
    { status: "WAITING_INSTALLATION", label: tr(locale, { kk: "Орнату", ru: "Установка" }) },
    { status: "WAITING_DELIVERY", label: tr(locale, { kk: "Жеткізу", ru: "Доставка" }) },
    { status: "COMPLETED", label: tr(locale, { kk: "Аяқталды", ru: "Завершён" }) },
  ];
}

export function OrderTimeline({
  statusHistory,
  fulfillmentType,
  dateFmt,
  locale,
}: {
  statusHistory: Array<{ toStatus: string; changedAt: Date }>;
  fulfillmentType: string | null;
  dateFmt: Intl.DateTimeFormat;
  locale: Locale;
}) {
  const reachedAt = new Map<string, Date>();
  for (const h of statusHistory) {
    if (!reachedAt.has(h.toStatus)) reachedAt.set(h.toStatus, h.changedAt);
  }

  const steps = getSteps(locale).filter((s) => {
    if (s.status === "WAITING_INSTALLATION") return fulfillmentType === "INSTALLATION" || reachedAt.has(s.status);
    if (s.status === "WAITING_DELIVERY") return fulfillmentType === "DELIVERY" || reachedAt.has(s.status);
    return true;
  });

  return (
    <div className="flex flex-wrap items-start gap-2 overflow-x-auto py-2">
      {steps.map((step, i) => {
        const at = reachedAt.get(step.status);
        const done = Boolean(at);
        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-accent text-white" : "bg-page-bg text-text-secondary"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${done ? "font-semibold text-text-primary" : "text-text-secondary"}`}>{step.label}</span>
              <span className="text-[10px] text-text-secondary">{at ? dateFmt.format(at) : "—"}</span>
            </div>
            {i < steps.length - 1 && <div className={`mx-2 h-0.5 w-8 ${done ? "bg-accent" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}
