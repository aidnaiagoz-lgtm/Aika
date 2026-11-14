import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { isLeader } from "@/lib/access";
import type { Locale } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import { listUnifiedOrders, type UnifiedFilters, type UnifiedRow } from "@/lib/domain/orders/unified";
import type { ActingUser } from "@/lib/domain/orders/types";

type Props = {
  user: ActingUser;
  locale: Locale;
  filters: { who?: string; src?: string; q?: string };
};

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

/** «Заказдар» беті: сайт заказдары + Google кестедегі ескі заказдар бір тізімде (2026-11-14). */
export async function UnifiedOrders({ user, locale, filters }: Props) {
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const q = (filters.q ?? "").trim().slice(0, 80);
  // Басшыға әдепкі — «Барлығы»; менеджерге — «Менің»; іздегенде — бүкіл тарих (клиент басқа менеджерден алған болуы мүмкін).
  const who: UnifiedFilters["who"] = filters.who === "mine" || filters.who === "all" ? filters.who : isLeader(user) || q ? "all" : "mine";
  const src: UnifiedFilters["src"] = filters.src === "site" || filters.src === "sheet" ? filters.src : "all";

  let data: Awaited<ReturnType<typeof listUnifiedOrders>> | "forbidden";
  try {
    data = await listUnifiedOrders(user, { who, src, q });
  } catch (e) {
    if (e instanceof ForbiddenError) data = "forbidden";
    else throw e;
  }
  if (data === "forbidden") return <AccessDenied locale={locale} />;
  const { rows, limited } = data;

  const href = (p: Partial<{ who: string; src: string; q: string }>) => {
    const sp = new URLSearchParams();
    const next = { who, src, q, ...p };
    sp.set("who", next.who);
    if (next.src !== "all") sp.set("src", next.src);
    if (next.q) sp.set("q", next.q);
    return `/orders?${sp.toString()}`;
  };
  const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-text-primary">{t("Заказдар", "Заказы")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/orders/analytics" className="rounded-pill bg-page-bg px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-border">
            {t("Аналитика / KPI", "Аналитика / KPI")}
          </Link>
          {isLeader(user) && (
            <Link href="/orders/archive" className="rounded-pill bg-page-bg px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-border">
              {t("Архив", "Архив")}
            </Link>
          )}
          <Link href="/orders/new" className="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            {t("+ Жаңа заказ", "+ Новый заказ")}
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Segment
            items={[
              { on: who === "mine", href: href({ who: "mine" }), label: t("Менің заказдарым", "Мои заказы") },
              { on: who === "all", href: href({ who: "all" }), label: t("Барлығы", "Все") },
            ]}
          />
          <Segment
            items={[
              { on: src === "all", href: href({ src: "all" }), label: t("Бәрі", "Все") },
              { on: src === "site", href: href({ src: "site" }), label: t("🟢 Сайттан", "🟢 С сайта") },
              { on: src === "sheet", href: href({ src: "sheet" }), label: t("🔵 Google (ескі)", "🔵 Google (старые)") },
            ]}
          />
          <form method="GET" action="/orders" className="flex flex-1 gap-2">
            <input type="hidden" name="who" value={filters.who === "mine" || filters.who === "all" ? filters.who : ""} />
            {src !== "all" && <input type="hidden" name="src" value={src} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t("🔍 Телефон, клиент аты, көлік, тауар...", "🔍 Телефон, имя клиента, авто, товар...")}
              className="min-w-0 flex-1 rounded-pill border-2 border-accent/40 bg-page-bg px-4 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
            <button type="submit" className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
              {t("Іздеу", "Найти")}
            </button>
          </form>
        </div>
      </Card>

      <Card
        title={
          q
            ? t(`Табылды: ${rows.length} заказ — клиенттің тарихы`, `Найдено: ${rows.length} — история клиента`)
            : who === "mine"
              ? t("Менің соңғы заказдарым", "Мои последние заказы")
              : t("Соңғы заказдар", "Последние заказы")
        }
      >
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">
            {q ? t("Ештеңе табылмады — телефонның соңғы 7 цифрын жазып көріңіз", "Ничего не найдено — попробуйте последние 7 цифр телефона") : t("Заказ жоқ", "Заказов нет")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-text-secondary">
                  {[
                    t("Күні", "Дата"),
                    t("Көзі", "Источник"),
                    t("Клиент", "Клиент"),
                    t("Көлік", "Авто"),
                    t("Тауар", "Товар"),
                    t("Сомасы", "Сумма"),
                    t("Төленді", "Оплачено"),
                    t("Қалдық", "Остаток"),
                    t("Менеджер", "Менеджер"),
                    t("Цех", "Цех"),
                    "",
                  ].map((h, i) => (
                    <th key={i} className="whitespace-nowrap pb-3 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.key} r={r} t={t} date={dateFmt.format(r.date)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {limited && (
          <p className="pt-3 text-center text-xs text-text-secondary">
            {t("Соңғы заказдар ғана көрсетілді — ескісін табу үшін телефонмен немесе атымен іздеңіз", "Показаны только последние — для старых используйте поиск")}
          </p>
        )}
      </Card>

      <p className="text-center text-xs text-text-secondary">
        <Link href="/orders?view=erp" className="hover:underline">
          {t("Кеңейтілген сүзгілер (тек сайт заказдары) →", "Расширенные фильтры (только заказы с сайта) →")}
        </Link>
      </p>
    </div>
  );
}

const WS: Record<UnifiedRow["workshop"], { kk: string; ru: string; dot: string } | null> = {
  none: null,
  marked: { kk: "Цех ✓", ru: "Цех ✓", dot: "#9aa0b4" },
  NEW: { kk: "Кезекте", ru: "В очереди", dot: "#9aa0b4" },
  IN_PROGRESS: { kk: "Тігілуде", ru: "Шьётся", dot: "#f2b01e" },
  DONE: { kk: "Дайын", ru: "Готово", dot: "#22a35a" },
  CANCELLED: { kk: "Тоқтатылды", ru: "Отменён", dot: "#e0483d" },
};

function Row({ r, t, date }: { r: UnifiedRow; t: (kk: string, ru: string) => string; date: string }) {
  const ws = WS[r.workshop];
  return (
    <tr className={`border-t border-border align-middle ${r.mine ? "bg-accent/5" : ""}`}>
      <td className="whitespace-nowrap py-3 pr-4 text-text-secondary">{date}</td>
      <td className="whitespace-nowrap py-3 pr-4">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.source === "site" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
        >
          {r.source === "site" ? t("Сайт", "Сайт") : "Google"} · {r.label}
        </span>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <div className="text-text-primary">{r.customerName || "—"}</div>
        <div className="text-xs text-text-secondary">{r.phone}</div>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <div className="text-text-primary">{r.car || "—"}</div>
        {r.carYear && <div className="text-xs text-text-secondary">{r.carYear}</div>}
      </td>
      <td className="min-w-[260px] max-w-[360px] py-3 pr-4">
        <div className="line-clamp-2 text-text-primary">{r.products.join(", ") || "—"}</div>
        {r.detail && <div className="truncate text-xs text-text-secondary">{r.detail}</div>}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 tabular-nums">{money(r.total)}</td>
      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-text-secondary">{money(r.paid)}</td>
      <td className={`whitespace-nowrap py-3 pr-4 font-semibold tabular-nums ${r.remainder > 0 ? "text-danger" : "text-emerald-600"}`}>
        {r.remainder > 0 ? money(r.remainder) : "0 ✓"}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <span className={r.mine ? "font-semibold text-text-primary" : "text-text-secondary"}>
          {r.manager || "—"}
          {r.mine && ` (${t("мен", "я")})`}
        </span>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {ws ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ws.dot }} />
            {t(ws.kk, ws.ru)}
          </span>
        ) : (
          <span className="text-text-secondary">—</span>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-2 text-xs">
        {r.href ? (
          <Link href={r.href} className="font-semibold text-accent hover:underline">
            {r.source === "site" ? t("Ашу", "Открыть") : r.canEdit ? t("Продажиде өзгерту ↗", "Изменить в Продажах ↗") : t("Продажиде ашу ↗", "Открыть в Продажах ↗")}
          </Link>
        ) : (
          <span className="text-text-secondary">🔒 {t("тек көру", "только просмотр")}</span>
        )}
      </td>
    </tr>
  );
}

function Segment({ items }: { items: { on: boolean; href: string; label: string }[] }) {
  return (
    <div className="inline-flex shrink-0 rounded-pill bg-page-bg p-1">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          scroll={false}
          className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-semibold ${i.on ? "bg-surface text-accent shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
