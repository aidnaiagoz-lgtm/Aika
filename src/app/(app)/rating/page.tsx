import Link from "next/link";
import { after } from "next/server";
import { maybeSyncFromGoogleSheet, lastSheetSyncAt } from "@/lib/domain/sales-ledger/sheet-sync";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  ShieldCheck,
  Repeat,
  CalendarCheck,
  Flame,
  Target,
  Trophy,
  Award,
  Lightbulb,
  Lock,
  ArrowUpRight,
  Crown,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { getRatingData, PERIODS, type Period, type BoardRow, type RatingData } from "@/lib/domain/rating";
import { getLocale } from "@/lib/locale";

/** Тіл: t("қазақша", "орысша") — беттің барлық мәтіні екі тілде. */
type T = (kk: string, ru: string) => string;

// Дизайн: AutoMax бренді — қою көк (#0b1a45) + көк (#1f4fd8), бейтарап сұр фон, эмодзисіз.
const BRAND = "#1f4fd8";
const NAVY = "#0b1a45";
const MEDAL: Record<number, { ring: string; fill: string; text: string; label: string }> = {
  1: { ring: "#d4a017", fill: "linear-gradient(135deg,#f7d774,#d4a017)", text: "#5c4300", label: "1" },
  2: { ring: "#a8b0bd", fill: "linear-gradient(135deg,#e9edf2,#a8b0bd)", text: "#3b4350", label: "2" },
  3: { ring: "#c07a45", fill: "linear-gradient(135deg,#f1c19c,#c07a45)", text: "#4d2a10", label: "3" },
};

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const PERIOD_KK: Record<Period, string> = { day: "Бүгін", week: "Апта", month: "Ай", lastMonth: "Өткен ай", year: "Жыл" };
const PERIOD_RU: Record<Period, string> = { day: "Сегодня", week: "Неделя", month: "Месяц", lastMonth: "Прошлый месяц", year: "Год" };
const periodLabel = (t: T, p: Period) => t(PERIOD_KK[p], PERIOD_RU[p]);
const MONTHS_KK = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_RU_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS_KK = ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
const WEEKDAYS_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const monthName = (t: T, ym: string) => t(MONTHS_KK[Number(ym.slice(5, 7)) - 1], MONTHS_RU[Number(ym.slice(5, 7)) - 1]);
const dayLabel = (t: T, d: string) =>
  `${Number(d.slice(8, 10))} ${t(MONTHS_KK[Number(d.slice(5, 7)) - 1].toLowerCase(), MONTHS_RU_GEN[Number(d.slice(5, 7)) - 1])}`;

function initials(name: string) {
  const parts = name.replace(/\d+/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.charAt(0).toUpperCase();
}

function Avatar({ name, size = 36, me = false, ring }: { name: string; size?: number; me?: boolean; ring?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: me ? "#fff" : NAVY,
        background: me ? BRAND : "#e3e9f7",
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}

function Change({ n }: { n: number }) {
  if (n > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#15803d]"><TrendingUp size={13} />{n}</span>;
  if (n < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#b42318]"><TrendingDown size={13} />{-n}</span>;
  return <span className="text-xs text-text-secondary">—</span>;
}

function SectionTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
        <Icon size={17} className="text-[#1f4fd8]" strokeWidth={2} />
        {title}
      </h2>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
}

export default async function RatingPage({ searchParams }: { searchParams: Promise<{ p?: string; pw?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.p as Period) ? (sp.p as Period) : "month";
  const leader = isLeader(user);
  const locale = await getLocale();
  const t: T = (kk, ru) => (locale === "ru" ? ru : kk);
  const [data, lastSync] = await Promise.all([getRatingData({ period, employeeId: user.employee?.id ?? null, locale }), lastSheetSyncAt()]);
  // Google таблицадан жаңарту — жауап жіберілгеннен кейін, 10 минутта ең көбі бір рет
  after(maybeSyncFromGoogleSheet);
  const myId = user.employee?.id ?? null;
  const firstName = (user.employee?.fullName ?? "").split(" ")[0] || t("әріптес", "коллега");

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      {sp.pw === "ok" && (
        <div className="flex items-center gap-2 rounded-[14px] border border-[#bbe5c8] bg-[#f0faf3] px-4 py-3 text-sm font-medium text-[#15803d]">
          <CheckCircle2 size={16} /> {t("Пароль сәтті өзгертілді", "Пароль успешно изменён")}
        </div>
      )}

      <Hero data={data} firstName={firstName} leader={leader} t={t} />
      {lastSync && (
        <div className="-mt-2 text-right text-xs text-text-secondary">
          {t("Google таблицадан жаңартылды:", "Обновлено из Google таблицы:")}{" "}
          {new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(lastSync)}
          {leader && (
            <>
              {" · "}
              <Link href="/import#sheet-sync" className="font-semibold text-[#1f4fd8] hover:underline">
                {t("қазір жаңарту", "обновить сейчас")}
              </Link>
            </>
          )}
        </div>
      )}

      {/* Кезең таңдау — бір ғана жерде (беттің жоғарысында); көрсеткіштер мен рейтинг кестесі бірге ауысады */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {leader ? t("Көрсеткіштер", "Показатели") : t("Рейтинг", "Рейтинг")} · {periodLabel(t, period).toLowerCase()}
          </span>
          <PeriodTabs period={period} t={t} />
        </div>
        {leader && <LeaderKpis data={data} t={t} />}
      </div>

      <Nominations data={data} myId={myId} t={t} />

      {data.me && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
          <SelfCard data={data} t={t} />
          <NearMe data={data} myId={myId!} t={t} />
        </div>
      )}

      {data.me && <Tip data={data} t={t} />}

      <Leaderboard data={data} myId={myId} leader={leader} period={period} t={t} />
    </div>
  );
}

function Hero({ data, firstName, leader, t }: { data: RatingData; firstName: string; leader: boolean; t: T }) {
  const day = new Date(data.today + "T00:00:00Z");
  const goal = data.team.goal;
  const pct = goal ? Math.min(100, Math.round((data.team.monthItems / goal.teamItems) * 100)) : 0;
  const me = data.me;
  const champ = data.lastMonthChampion;
  return (
    <section
      className="rating-rise relative overflow-hidden rounded-[22px] px-7 py-6 text-white"
      style={{ background: `linear-gradient(115deg, ${NAVY} 0%, #12275f 60%, #183a8c 100%)` }}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, #3d7bff 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex-1">
          <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#9fb1e3]">
            {t(WEEKDAYS_KK[day.getUTCDay()], WEEKDAYS_RU[day.getUTCDay()])}, {dayLabel(t, data.today)}
          </div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{t("Қайырлы күн", "Добрый день")}, {firstName}</h1>
          <p className="mt-1 text-sm text-[#b8c5ec]">
            {me
              ? me.todayItems > 0
                ? t(`Бүгін ${me.todayItems} тауар сатылды · ${money(me.todayRevenue)}`, `Сегодня продано ${me.todayItems} тов. · ${money(me.todayRevenue)}`)
                : t("Бүгін әзірге сатылым жоқ — күнді бірінші болып бастаңыз", "Сегодня продаж пока нет — начните день первым")
              : t(`Айдың соңына ${data.team.daysLeft} күн қалды`, `До конца месяца ${data.team.daysLeft} дн.`)}
          </p>

          <div className="mt-5 max-w-xl">
            {goal ? (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-[#d6def6]">
                    <Target size={15} /> {t("Команда мақсаты", "Цель команды")} · {num(goal.teamItems)} {t("тауар", "тов.")}
                  </span>
                  <span className="font-semibold">
                    {num(data.team.monthItems)} / {num(goal.teamItems)} <span className="text-[#9fb1e3]">· {pct}%</span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                  <i className="rating-bar block h-full rounded-full bg-[#4ade80]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#9fb1e3]">
                  {data.team.monthItems >= goal.teamItems
                    ? t("Мақсат орындалды", "Цель выполнена")
                    : t(`Тағы ${num(goal.teamItems - data.team.monthItems)} тауар`, `Ещё ${num(goal.teamItems - data.team.monthItems)} тов.`)}
                  {goal.reward ? ` · ${t("Сыйлық", "Награда")}: ${goal.reward}` : ""}
                  {me ? ` · ${t("Сіздің үлесіңіз", "Ваш вклад")}: ${num(me.monthItems)} ${t("тауар", "тов.")}` : ""}
                </p>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-[#9fb1e3]">
                <Target size={15} /> {t("Осы айдың команда мақсаты әлі қойылмаған", "Цель команды на этот месяц ещё не задана")}
                {leader ? t(" — «Мақсаттар» бетінде қойыңыз", " — задайте на странице «Цели»") : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {champ && (
            <div className="min-w-[190px] rounded-[16px] border border-white/12 bg-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#e9c46a]">
                <Crown size={13} /> {t(`${monthName(t, champ.month)} чемпионы`, `Чемпион: ${monthName(t, champ.month).toLowerCase()}`)}
              </div>
              <div className="mt-1 text-lg font-semibold">{champ.name}</div>
              <div className="text-xs text-[#b8c5ec]">
                {money(champ.revenue)} · {num(champ.items)} {t("тауар", "тов.")}
              </div>
            </div>
          )}
          {me && (
            <>
              <HeroStat
                label={t("Өткен айдан", "К прошлому месяцу")}
                value={me.growthPct === null ? t("жаңа", "новый") : `${me.growthPct >= 0 ? "+" : ""}${me.growthPct}%`}
                tone={me.growthPct !== null && me.growthPct < 0 ? "neg" : "pos"}
              />
              <HeroStat label={t("Серия", "Серия")} value={t(`${me.streak} күн`, `${me.streak} дн.`)} icon={Flame} />
              <HeroStat label={t("Апталық орын", "Место за неделю")} value={`#${me.weekRank}`} extra={<Change n={me.weekRankChange} />} />
            </>
          )}
          {!me && leader && (
            <>
              <HeroStat label={t("Ай · тауар", "Месяц · товары")} value={num(data.team.monthItems)} />
              <HeroStat label={t("Менеджер", "Менеджеры")} value={String(data.board.length)} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, tone, icon: Icon, extra }: { label: string; value: string; tone?: "pos" | "neg"; icon?: LucideIcon; extra?: React.ReactNode }) {
  return (
    <div className="min-w-[120px] rounded-[16px] border border-white/12 bg-white/[0.06] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[#9fb1e3]">{label}</div>
      <div
        className={`mt-1 flex items-center gap-1.5 text-[22px] font-semibold ${tone === "pos" ? "text-[#4ade80]" : tone === "neg" ? "text-[#fca5a5]" : ""}`}
      >
        {Icon && <Icon size={18} className="text-[#fbbf24]" />}
        {value} {extra}
      </div>
    </div>
  );
}

/** Кезең таңдау. scroll={false} — басқанда бет орнынан қозғалмайды. */
function PeriodTabs({ period, t }: { period: Period; t: T }) {
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/rating?p=${p}`}
          scroll={false}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${p === period ? "text-white" : "text-text-secondary hover:text-text-primary"}`}
          style={p === period ? { background: NAVY } : undefined}
        >
          {periodLabel(t, p)}
        </Link>
      ))}
    </div>
  );
}

function LeaderKpis({ data, t }: { data: RatingData; t: T }) {
  const tag = (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-[#fff6e0] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00]">
      <Lock size={9} /> CEO
    </span>
  );
  // Төмендегі «Толық рейтинг» қойындысы (Бүгін / Апта / Ай / Өткен ай / Жыл) осы көрсеткіштерді де ауыстырады
  const p = data.periodTeam;
  const label = periodLabel(t, data.period).toLowerCase();
  const compareTo: Record<Period, string> = {
    day: t("кешегіден", "ко вчера"),
    week: t("өткен аптаның осы кезеңінен", "к тому же периоду прошлой недели"),
    month: t("өткен айдың осы кезеңінен", "к тому же периоду прошлого месяца"),
    lastMonth: t("алдыңғы айдан", "к позапрошлому месяцу"),
    year: t("өткен жылдың осы кезеңінен", "к тому же периоду прошлого года"),
  };
  // «Бүгін» әлі біткен жоқ — толық кешегі күнмен % салыстыру жаңылыстырады, сондықтан кешегі соманы көрсетеміз
  const growth =
    data.period === "day"
      ? `${t("кеше", "вчера")}: ${money(p.prevRevenue)}`
      : p.growthPct === null
      ? p.revenue > 0
        ? t("салыстыратын дерек жоқ", "нет данных для сравнения")
        : t("әзірге сатылым жоқ", "продаж пока нет")
      : `${p.growthPct >= 0 ? "+" : ""}${p.growthPct}% ${compareTo[data.period]}`;
  const items = [
    { l: `${t("Айналым", "Выручка")} (${label})`, v: money(p.revenue), s: growth },
    { l: `${t("Клиент қарызы", "Долг клиентов")} (${label})`, v: money(p.debt), s: t("осы кезеңдегі сатылымдардың қалдығы", "остаток по продажам за период"), danger: p.debt > 0 },
    { l: `${t("Бонус қоры", "Бонусный фонд")} (${label})`, v: money(p.bonus), s: t(`${p.orders} сатылым · ${p.items} тауар`, `продаж: ${p.orders} · товаров: ${p.items}`) },
    { l: `${t("Орташа чек", "Средний чек")} (${label})`, v: money(p.avgCheck), s: p.orders ? t(`${p.orders} сатылымнан`, `из ${p.orders} продаж`) : t("сатылым жоқ", "продаж нет") },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.l} className="rounded-[16px] border border-border bg-surface px-4 py-3.5">
          <div className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {k.l}
            {tag}
          </div>
          <div className={`mt-1.5 text-xl font-semibold ${k.danger ? "text-[#b42318]" : "text-text-primary"}`}>{k.v}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{k.s}</div>
        </div>
      ))}
    </div>
  );
}

const NOM_ICON: Record<string, LucideIcon> = {
  grower: TrendingUp,
  first: Zap,
  debtfree: ShieldCheck,
  oldclient: Repeat,
  steady: CalendarCheck,
};

function Nominations({ data, myId, t }: { data: RatingData; myId: string | null; t: T }) {
  return (
    <section>
      <SectionTitle icon={Award} title={t("Апта номинациялары", "Номинации недели")} hint={t("әр дүйсенбі жаңаланады", "обновляются по понедельникам")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {data.nominations.map((n, i) => {
          const mine = n.winnerEmployeeId !== null && n.winnerEmployeeId === myId;
          const Icon = NOM_ICON[n.id] ?? Award;
          return (
            <div
              key={n.id}
              className={`rating-rise relative flex items-center gap-3 rounded-[16px] border p-3.5 ${
                mine ? "border-[#86d19e] bg-[#f0faf3]" : "border-border bg-surface"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
                style={{ background: mine ? "#16a34a" : "#eef2fb", color: mine ? "#fff" : BRAND }}
              >
                <Icon size={19} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary">{n.title}</div>
                <div className="truncate text-sm font-semibold text-text-primary">
                  {n.winner ?? "—"}
                  {mine && <span className="ml-1.5 text-xs font-medium text-[#15803d]">· {t("сіз", "вы")}</span>}
                </div>
                <div className="truncate text-xs text-text-secondary">{n.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelfCard({ data, t }: { data: RatingData; t: T }) {
  const me = data.me!;
  const max = Math.max(1, ...me.months.map((m) => m.revenue));
  const toRecord = me.record ? me.record.items - me.todayItems + 1 : null;
  return (
    <section className="flex flex-col rounded-[20px] border border-border bg-surface p-5">
      <SectionTitle icon={TrendingUp} title={t("Менің нәтижем", "Мой результат")} hint={t("тек сізге көрінеді", "видно только вам")} />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="sm:w-[46%]">
          {me.growthPct === null ? (
            <div className="text-2xl font-semibold text-[#1f4fd8]">{t("Жаңа бастама", "Новый старт")}</div>
          ) : (
            <div className={`text-[44px] font-semibold leading-none tracking-tight ${me.growthPct < 0 ? "text-[#b42318]" : "text-[#15803d]"}`}>
              {`${me.growthPct >= 0 ? "+" : ""}${me.growthPct}%`}
            </div>
          )}
          <div className="mt-2 text-[13px] text-text-secondary">
            {t("өткен айдың осы кезеңі", "тот же период прошлого месяца")} {money(me.lastMonthSamePeriod)} → {t("қазір", "сейчас")} {money(me.monthRevenue)}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-text-secondary">
            {[
              [periodLabel(t, "day"), me.todayRevenue, me.todayItems],
              [periodLabel(t, "week"), me.weekRevenue, me.weekItems],
              [periodLabel(t, "month"), me.monthRevenue, me.monthItems],
            ].map(([l, r, it]) => (
              <div key={l as string} className="rounded-xl bg-page-bg px-2.5 py-2">
                {l}
                <b className="mt-0.5 block text-[13px] font-semibold text-text-primary">{money(r as number)}</b>
                {it as number} {t("тауар", "тов.")}
              </div>
            ))}
          </div>
        </div>
        <div className="flex h-[170px] flex-1 items-end gap-3">
          {me.months.map((m, i) => {
            const cur = i === me.months.length - 1;
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5 text-[11px] text-text-secondary">
                <span className={`text-[10.5px] ${cur ? "font-semibold text-[#1f4fd8]" : ""}`}>{m.revenue ? `${Math.round(m.revenue / 1000)}k` : ""}</span>
                <i
                  className="rating-grow block w-full rounded-t-md"
                  style={{ height: `${Math.max(4, (m.revenue / max) * 130)}px`, background: cur ? BRAND : "#d9e2f6", animationDelay: `${i * 70}ms` }}
                />
                <span className={cur ? "font-semibold text-[#1f4fd8]" : ""}>{monthName(t, m.month).slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-2.5 rounded-xl border border-[#f3e2b3] bg-[#fffaf0] px-3 py-2.5 text-[13px] text-text-primary">
          <Trophy size={16} className="shrink-0 text-[#b7791f]" />
          <span>
            {me.record ? (
              <>
                {t("Жеке рекорд: бір күнде", "Личный рекорд: за день")} <b>{me.record.items}</b> {t("тауар", "тов.")} ({dayLabel(t, me.record.day)}).{" "}
                {t("Бүгін", "Сегодня")} — {me.todayItems}.
                {toRecord !== null && toRecord > 0 && <> {t("Рекордқа тағы", "До рекорда ещё")} <b>{toRecord}</b>.</>}
              </>
            ) : (
              t("Бірінші сатылым — бірінші рекорд.", "Первая продажа — первый рекорд.")
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-page-bg px-3 py-2.5 text-[13px]">
          <Lock size={14} className="text-text-secondary" /> {t("Бонус (ай)", "Бонус (месяц)")}: <b>{money(me.bonusMonth)}</b>
        </div>
      </div>
    </section>
  );
}

function NearMe({ data, myId, t }: { data: RatingData; myId: string; t: T }) {
  const board = data.board;
  const idx = board.findIndex((r) => r.employeeId === myId);
  const start = Math.max(0, Math.min(idx - 3, board.length - 4));
  const slice = board.slice(start, start + 4);
  const me = board[idx];
  const above = idx > 0 ? board[idx - 1] : null;
  return (
    <section className="flex flex-col rounded-[20px] border border-border bg-surface p-5">
      <SectionTitle icon={Trophy} title={`${t("Рейтинг", "Рейтинг")} · ${periodLabel(t, data.period).toLowerCase()}`} hint={t("маңайыңыздағылар", "рядом с вами")} />
      <div className="flex flex-col">
        {slice.map((r) => {
          const isMe = r.employeeId === myId;
          return (
            <div
              key={r.employeeId}
              className={`grid grid-cols-[22px_34px_1fr_auto] items-center gap-3 px-2 py-2.5 text-sm ${isMe ? "rounded-xl bg-[#eef3ff]" : "border-b border-border last:border-0"}`}
            >
              <span className="font-semibold" style={{ color: isMe ? BRAND : "#8a8f9c" }}>{r.rank}</span>
              <Avatar name={r.name} size={32} me={isMe} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{isMe ? `${r.name} · ${t("сіз", "вы")}` : r.name}</div>
                {isMe && above && (
                  <div className="flex items-center gap-1 text-xs text-[#1f4fd8]">
                    <ArrowUpRight size={12} /> {t(`${above.rank}-орынға`, `до ${above.rank}-го места`)} {money(Math.max(0, above.revenue - me.revenue))}
                  </div>
                )}
                {isMe && !above && <div className="text-xs font-medium text-[#15803d]">{t("Көшбасшысыз", "Вы лидер")}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold">{money(r.revenue)}</div>
                <div className="text-xs text-text-secondary">{r.items} {t("тауар", "тов.")}</div>
              </div>
            </div>
          );
        })}
      </div>
      <a href="#leaderboard" className="mt-auto pt-3 text-center text-sm font-semibold text-[#1f4fd8] hover:underline">
        {t("Толық рейтинг", "Полный рейтинг")} ↓
      </a>
    </section>
  );
}

function Tip({ data, t }: { data: RatingData; t: T }) {
  const me = data.me!;
  const team = data.team.avgCheck;
  let text: React.ReactNode;
  if (!me.avgCheck || !team) text = t("Осы айдың алғашқы сатылымдарынан кейін мұнда жеке ұсыныс шығады.", "После первых продаж месяца здесь появится персональный совет.");
  else if (me.avgCheck < team * 0.9)
    text = (
      <>
        {t("Орташа чегіңіз", "Ваш средний чек")} <b>{money(me.avgCheck)}</b>, {t("команда бойынша", "по команде")} — <b>{money(team)}</b>.{" "}
        {t(
          "Салонмен бірге багаж төсенішін немесе съемный полик ұсыну — чекті арттырудың ең жылдам жолы.",
          "Предлагать вместе с салоном коврик в багажник или съёмный полик — самый быстрый способ поднять чек.",
        )}
      </>
    );
  else
    text = (
      <>
        {t("Орташа чегіңіз", "Ваш средний чек")} <b>{money(me.avgCheck)}</b> — {t("команданың орташасынан", "выше среднего по команде")} ({money(team)})
        {t(" жоғары. Рейтингте көтерілудің келесі қадамы — тауар санын арттыру.", ". Следующий шаг в рейтинге — больше товаров.")}
      </>
    );
  return (
    <section className="flex items-start gap-3.5 rounded-[18px] border border-[#d6e0fa] bg-[#f5f8ff] px-5 py-4 text-sm leading-relaxed text-text-primary">
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-[#1f4fd8]" />
      <div>{text}</div>
    </section>
  );
}

function Leaderboard({ data, myId, leader, period, t }: { data: RatingData; myId: string | null; leader: boolean; period: Period; t: T }) {
  const top = data.board.slice(0, 3);
  const maxRev = Math.max(1, ...data.board.map((r) => r.revenue));
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean) as BoardRow[];
  const heights: Record<number, number> = { 1: 96, 2: 70, 3: 52 };
  const rangeLabel =
    period === "lastMonth"
      ? `${monthName(t, data.range[0])} ${data.range[0].slice(0, 4)} — ${t("толық ай", "весь месяц")}`
      : `${dayLabel(t, data.range[0])} — ${dayLabel(t, data.range[1])}`;

  return (
    <section id="leaderboard" className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Trophy size={19} className="text-[#1f4fd8]" /> {t("Толық рейтинг", "Полный рейтинг")}
          </h2>
          <div className="text-xs text-text-secondary">{rangeLabel}</div>
        </div>
      </div>

      {data.board.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          {t("Әзірге менеджер тіркелмеген.", "Менеджеров пока нет.")}
          {leader ? t(" «Excel импорт» немесе «Менеджерлер» бетінде аккаунт ашыңыз.", " Создайте аккаунты на странице «Excel импорт» или «Менеджеры».") : ""}
        </div>
      ) : (
        <>
          <div className="flex items-end justify-center gap-5 overflow-hidden rounded-[22px] px-4 pt-7" style={{ background: `linear-gradient(180deg, #12275f 0%, ${NAVY} 100%)` }}>
            {podiumOrder.map((r) => {
              const m = MEDAL[r.rank];
              return (
                <div key={r.employeeId} className="rating-rise flex w-[210px] flex-col items-center text-center text-white" style={{ animationDelay: `${(r.rank - 1) * 110}ms` }}>
                  <div className="relative">
                    <Avatar name={r.name} size={r.rank === 1 ? 84 : 66} me={r.employeeId === myId} ring={m.ring} />
                    <span
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0b1a45] text-xs font-bold"
                      style={{ background: m.fill, color: m.text }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <div className="mt-3 text-base font-semibold">{r.employeeId === myId ? `${r.name} · ${t("сіз", "вы")}` : r.name}</div>
                  <div className="text-lg font-semibold" style={{ color: r.rank === 1 ? "#f7d774" : "#fff" }}>{money(r.revenue)}</div>
                  <div className="text-xs text-[#9fb1e3]">{r.items} {t("тауар", "тов.")}</div>
                  <div
                    className="rating-grow mt-3 flex w-full justify-center rounded-t-xl border-x border-t border-white/10 bg-white/[0.07] pt-2 text-2xl font-semibold text-white/70"
                    style={{ height: heights[r.rank] }}
                  >
                    {r.rank}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-[20px] border border-border bg-surface px-4 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="py-2.5 pr-2">#</th>
                  <th className="py-2.5 pr-2">Менеджер</th>
                  <th className="w-[30%] py-2.5 pr-2">{t("Үлесі", "Доля")}</th>
                  <th className="py-2.5 pr-2 text-right">{t("Сома", "Сумма")}</th>
                  <th className="py-2.5 pr-2 text-right">{t("Тауар", "Товары")}</th>
                  <th className="py-2.5 pr-2 text-right">{t("Орташа чек", "Средний чек")}</th>
                  {leader && <th className="py-2.5 pr-2 text-right">{t("Бонус", "Бонус")}</th>}
                  {leader && <th className="py-2.5 pr-2 text-right">{t("Қарыз", "Долг")}</th>}
                  <th className="py-2.5 text-right">{t("Өзгеріс", "Изменение")}</th>
                </tr>
              </thead>
              <tbody>
                {data.board.map((r) => {
                  const isMe = r.employeeId === myId;
                  const medal = MEDAL[r.rank];
                  return (
                    <tr key={r.employeeId} className={`border-t border-border ${isMe ? "bg-[#f5f8ff]" : ""}`}>
                      <td className="py-2.5 pr-2">
                        {medal && r.revenue > 0 ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: medal.fill, color: medal.text }}>
                            {r.rank}
                          </span>
                        ) : (
                          <span className="pl-1.5 font-semibold text-text-secondary">{r.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className="flex items-center gap-2.5 font-semibold">
                          <Avatar name={r.name} size={30} me={isMe} />
                          {isMe ? `${r.name} · ${t("сіз", "вы")}` : r.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="h-2 overflow-hidden rounded-full bg-page-bg">
                          <i className="rating-bar block h-full rounded-full" style={{ width: `${(r.revenue / maxRev) * 100}%`, background: isMe ? BRAND : "#7d9ae6" }} />
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 text-right font-semibold">{money(r.revenue)}</td>
                      <td className="py-2.5 pr-2 text-right text-text-secondary">
                        {r.items}
                        {r.goalItems && period === "month" ? <span className="text-xs"> / {r.goalItems}</span> : null}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-text-secondary">{r.avgCheck ? money(r.avgCheck) : "—"}</td>
                      {leader && <td className="py-2.5 pr-2 text-right">{money(r.bonus)}</td>}
                      {leader && <td className={`py-2.5 pr-2 text-right ${r.remainder > 0 ? "text-[#b42318]" : ""}`}>{money(r.remainder)}</td>}
                      <td className="py-2.5 text-right">
                        <Change n={r.rankChange} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
