import Link from "next/link";
import { Card, AccessDenied } from "@/lib/ui";
import { ForbiddenError } from "@/lib/rbac";
import { isLeader } from "@/lib/access";
import type { Locale } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import { listUnifiedOrders, type UnifiedFilters, type UnifiedItem, type UnifiedRow, type WorkshopMark } from "@/lib/domain/orders/unified";
import type { ActingUser } from "@/lib/domain/orders/types";
import { ORDER_PERIODS, type OrderPeriod } from "@/lib/domain/orders/unified-calc";

type Props = {
  user: ActingUser;
  locale: Locale;
  filters: { who?: string; src?: string; q?: string; page?: string; period?: string };
};

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

/** «Заказдар» беті: сайт заказдары + Google кестедегі ескі заказдар бір тізімде (2026-11-14). */
export async function UnifiedOrders({ user, locale, filters }: Props) {
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const q = (filters.q ?? "").trim().slice(0, 80);
  // Басшыға әдепкі — «Барлығы»; менеджерге — «Менің»; іздегенде — бүкіл тарих (клиент басқа менеджерден алған болуы мүмкін).
  const who: UnifiedFilters["who"] = filters.who === "mine" || filters.who === "all" ? filters.who : isLeader(user) || q ? "all" : "mine";
  const period: OrderPeriod = ORDER_PERIODS.includes(filters.period as OrderPeriod) ? (filters.period as OrderPeriod) : "all";
  const PERIOD_LABEL: Record<OrderPeriod, string> = {
    today: t("Бүгін", "Сегодня"),
    yesterday: t("Кеше", "Вчера"),
    week: t("Апта", "Неделя"),
    month: t("Ай", "Месяц"),
    all: t("Барлығы", "Всё время"),
  };
  const src: UnifiedFilters["src"] = filters.src === "site" || filters.src === "sheet" ? filters.src : "all";

  let data: Awaited<ReturnType<typeof listUnifiedOrders>> | "forbidden";
  try {
    data = await listUnifiedOrders(user, { who, src, q, period, page: Number(filters.page) || 1 });
  } catch (e) {
    if (e instanceof ForbiddenError) data = "forbidden";
    else throw e;
  }
  if (data === "forbidden") return <AccessDenied locale={locale} />;
  const { rows, total, sum, page, pages } = data;

  const href = (p: Partial<{ who: string; src: string; q: string; page: number; period: OrderPeriod }>) => {
    const sp = new URLSearchParams();
    const next = { who, src, q, period, page: 1, ...p };
    sp.set("who", next.who);
    if (next.period !== "all") sp.set("period", next.period);
    if (next.src !== "all") sp.set("src", next.src);
    if (next.q) sp.set("q", next.q);
    if (next.page > 1) sp.set("page", String(next.page));
    return `/orders?${sp.toString()}`;
  };
  const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });
  const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
  const tm = (r: UnifiedRow) => (r.time ? timeFmt.format(r.time) : null);

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

      {/* Сүзгілер компьютерде экранның үстінде қатып тұрады (CEO өтініші); телефонда биік болғандықтан — жоқ. */}
      <div className="md:sticky md:-top-8 md:z-20 md:-mt-4 md:bg-page-bg md:pb-1 md:pt-4">
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
              {period !== "all" && <input type="hidden" name="period" value={period} />}
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
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Segment items={ORDER_PERIODS.map((p) => ({ on: period === p, href: href({ period: p }), label: PERIOD_LABEL[p] }))} />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-text-secondary">
                {t("Заказ", "Заказов")}: <b className="text-text-primary">{money(total)}</b>
              </span>
              <span className="text-text-secondary">
                {t("Сомасы", "Сумма")}: <b className="text-lg text-text-primary">{money(sum)} ₸</b>
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title={
          q
            ? t(`Табылды: ${total} заказ — клиенттің тарихы`, `Найдено: ${total} — история клиента`)
            : who === "mine"
              ? t(`Менің заказдарым · ${PERIOD_LABEL[period]} · ${money(total)}`, `Мои заказы · ${PERIOD_LABEL[period]} · ${money(total)}`)
              : t(`Барлық заказдар · ${PERIOD_LABEL[period]} · ${money(total)}`, `Все заказы · ${PERIOD_LABEL[period]} · ${money(total)}`)
        }
      >
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">
            {q ? t("Ештеңе табылмады — телефонның соңғы 7 цифрын жазып көріңіз", "Ничего не найдено — попробуйте последние 7 цифр телефона") : t("Заказ жоқ", "Заказов нет")}
          </p>
        ) : (
          <>
          {/* Телефонда — карточкалар (кесте кең) */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <MobileCard key={r.key} r={r} t={t} date={dateFmt.format(r.date)} time={tm(r)} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-text-secondary">
                  {[
                    t("Күні", "Дата"),
                    t("Көзі", "Источник"),
                    t("Клиент", "Клиент"),
                    t("Көлік", "Авто"),
                    t("Тауарлар", "Товары"),
                    t("Барлығы", "Итого"),
                    t("Төленді", "Оплачено"),
                    t("Қалдық", "Остаток"),
                    t("Менеджер", "Менеджер"),
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
                  <Row key={r.key} r={r} t={t} date={dateFmt.format(r.date)} time={tm(r)} />
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {pages > 1 && <Pager page={page} pages={pages} href={(n) => href({ page: n })} t={t} />}
      </Card>

      <p className="text-center text-xs text-text-secondary">
        <Link href="/orders?view=erp" className="hover:underline">
          {t("Кеңейтілген сүзгілер (тек сайт заказдары) →", "Расширенные фильтры (только заказы с сайта) →")}
        </Link>
      </p>
    </div>
  );
}

const WS: Record<WorkshopMark, { kk: string; ru: string; dot: string } | null> = {
  none: null,
  marked: { kk: "Цех", ru: "Цех", dot: "#9aa0b4" },
  NEW: { kk: "Кезекте", ru: "В очереди", dot: "#9aa0b4" },
  IN_PROGRESS: { kk: "Цехта", ru: "В цехе", dot: "#f2b01e" },
  DONE: { kk: "Дайын", ru: "Готово", dot: "#22a35a" },
  CANCELLED: { kk: "Тоқтатылды", ru: "Отменён", dot: "#e0483d" },
};

type T = (kk: string, ru: string) => string;
const SHOW = 3; // алғашқы 3 тауар көрінеді, қалғаны «+N тауар ▾»

function ItemLine({ it, t }: { it: UnifiedItem; t: T }) {
  const ws = WS[it.workshop];
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <div className="text-text-primary">
          {it.kind && <span className="font-semibold">{it.kind} · </span>}
          {it.name}
          {ws && (
            <span className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full" style={{ background: ws.dot }} />
              {t(ws.kk, ws.ru)}
            </span>
          )}
        </div>
        {it.detail && <div className="truncate text-xs text-text-secondary">{it.detail}</div>}
      </div>
      <div className="shrink-0 font-semibold tabular-nums text-text-primary">{money(it.amount)}</div>
    </div>
  );
}

function Items({ r, t }: { r: UnifiedRow; t: T }) {
  if (r.items.length === 0) return <span className="text-text-secondary">—</span>;
  const head = r.items.slice(0, SHOW);
  const rest = r.items.slice(SHOW);
  return (
    <div className="flex flex-col">
      {r.items.length > 1 && (
        <span className="mb-1 self-start rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
          {r.items.length} {t("тауар", "товара")}
        </span>
      )}
      {head.map((it, i) => (
        <ItemLine key={i} it={it} t={t} />
      ))}
      {rest.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none py-0.5 text-xs font-bold text-accent">
            <span className="group-open:hidden">+{rest.length} {t("тауар ▾", "товар ▾")}</span>
            <span className="hidden group-open:inline">{t("Жию ▴", "Свернуть ▴")}</span>
          </summary>
          {rest.map((it, i) => (
            <ItemLine key={i} it={it} t={t} />
          ))}
        </details>
      )}
    </div>
  );
}

function SourceBadge({ r, t }: { r: UnifiedRow; t: T }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${r.source === "site" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
      {r.source === "site" ? t("Сайт", "Сайт") : "Google"} · {r.label}
    </span>
  );
}

function Action({ r, t }: { r: UnifiedRow; t: T }) {
  return r.href ? (
    <Link href={r.href} className="font-semibold text-accent hover:underline">
      {r.source === "site" ? t("Ашу", "Открыть") : r.canEdit ? t("Продажиде өзгерту ↗", "Изменить в Продажах ↗") : t("Продажиде ашу ↗", "Открыть в Продажах ↗")}
    </Link>
  ) : (
    <span className="text-text-secondary">🔒 {t("тек көру", "только просмотр")}</span>
  );
}

function Remainder({ r }: { r: UnifiedRow }) {
  return <span className={`font-semibold tabular-nums ${r.remainder > 0 ? "text-danger" : "text-emerald-600"}`}>{r.remainder > 0 ? money(r.remainder) : "0 ✓"}</span>;
}

function Row({ r, t, date, time }: { r: UnifiedRow; t: T; date: string; time: string | null }) {
  return (
    <tr className={`border-t border-border align-top ${r.mine ? "bg-accent/5" : ""}`}>
      <td className="whitespace-nowrap py-3 pr-4 text-text-secondary">
        <div>{date}</div>
        {time && <div className="text-xs font-semibold text-text-primary">🕒 {time}</div>}
      </td>
      <td className="py-3 pr-4">
        <SourceBadge r={r} t={t} />
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <div className="font-semibold text-text-primary">{r.customerName || "—"}</div>
        <div className="text-xs text-text-secondary">{r.phone}</div>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <div className="text-text-primary">{r.car || "—"}</div>
        {r.carYear && <div className="text-xs text-text-secondary">{r.carYear}</div>}
      </td>
      <td className="min-w-[300px] max-w-[440px] py-3 pr-6">
        <Items r={r} t={t} />
      </td>
      <td className="whitespace-nowrap py-3 pr-4 font-bold tabular-nums">{money(r.total)}</td>
      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-text-secondary">{money(r.paid)}</td>
      <td className="whitespace-nowrap py-3 pr-4">
        <Remainder r={r} />
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <span className={r.mine ? "font-semibold text-text-primary" : "text-text-secondary"}>
          {r.manager || "—"}
          {r.mine && ` (${t("мен", "я")})`}
        </span>
      </td>
      <td className="whitespace-nowrap py-3 pr-2 text-xs">
        <Action r={r} t={t} />
      </td>
    </tr>
  );
}

/** Телефондағы карточка: клиент, көлік, тауарлар, сомалар. */
function MobileCard({ r, t, date, time }: { r: UnifiedRow; t: T; date: string; time: string | null }) {
  return (
    <div className={`rounded-icon border border-border p-3 text-sm ${r.mine ? "bg-accent/5" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <SourceBadge r={r} t={t} />
        <span className="text-xs text-text-secondary">
          {date}
          {time && <b className="ml-1 text-text-primary">· {time}</b>}
        </span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-text-primary">{r.customerName || "—"}</div>
          <div className="text-xs text-text-secondary">{r.phone}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-text-primary">{r.car || "—"}</div>
          {r.carYear && <div className="text-xs text-text-secondary">{r.carYear}</div>}
        </div>
      </div>
      <div className="mt-2 border-t border-border pt-2">
        <Items r={r} t={t} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <span className="text-text-secondary">
          {t("Барлығы", "Итого")} <b className="text-text-primary">{money(r.total)}</b> · {t("қалдық", "остаток")} <Remainder r={r} />
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={r.mine ? "font-semibold text-text-primary" : "text-text-secondary"}>
          {r.manager || "—"}
          {r.mine && ` (${t("мен", "я")})`}
        </span>
        <Action r={r} t={t} />
      </div>
    </div>
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

function Pager({
  page,
  pages,
  href,
  t,
  top = false,
}: {
  page: number;
  pages: number;
  href: (n: number) => string;
  t: (kk: string, ru: string) => string;
  /** Тізімнің үстіндегі нұсқасы (CEO: беттер үстінде де тұрсын). */
  top?: boolean;
}) {
  // 1 … 4 5 [6] 7 8 … 125
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= Math.min(pages, 200)).sort((a, b) => a - b);
  const btn = "min-w-9 rounded-pill px-3 py-1.5 text-center text-sm font-semibold";
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1.5 ${
        top
          ? "pb-4 lg:justify-end"
          : // Астындағысы экранның төменгі жағында қатып тұрады (sticky) — CEO өтініші; телефонда төменгі мәзірдің үстінде.
            "sticky bottom-[52px] z-10 -mx-5 -mb-5 mt-2 rounded-b-card border-t border-border/60 bg-surface px-5 py-2.5 md:-bottom-8"
      }`}
    >
      {page > 1 && (
        <Link href={href(page - 1)} className={`${btn} bg-page-bg text-text-primary hover:bg-border`}>
          ← {t("Алдыңғы", "Назад")}
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-text-secondary">…</span>}
          <Link href={href(n)} className={`${btn} ${n === page ? "bg-accent text-white" : "bg-page-bg text-text-primary hover:bg-border"}`}>
            {n}
          </Link>
        </span>
      ))}
      {page < Math.min(pages, 200) && (
        <Link href={href(page + 1)} className={`${btn} bg-page-bg text-text-primary hover:bg-border`}>
          {t("Келесі 100", "Следующие 100")} →
        </Link>
      )}
    </div>
  );
}
