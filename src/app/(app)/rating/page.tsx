import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { getRatingData, PERIODS, type Period, type BoardRow, type RatingData } from "@/lib/domain/rating";

// Бренд түстері (AutoMax логотипі — көк)
const BRAND = "#1f4fd8";

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
const PERIOD_LABEL: Record<Period, string> = { day: "Бүгін", week: "Апта", month: "Ай", year: "Жыл" };
const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const WEEKDAYS = ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${monthName(d).toLowerCase()}`;

function Avatar({ name, size = 36, me = false, ring }: { name: string; size?: number; me?: boolean; ring?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: me ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3d7bff,#1f4fd8)",
        boxShadow: ring ? `0 0 0 4px ${ring}` : undefined,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Change({ n }: { n: number }) {
  if (n > 0) return <span className="text-xs font-bold text-[#16a34a]">▲ {n}</span>;
  if (n < 0) return <span className="text-xs font-bold text-danger">▼ {-n}</span>;
  return <span className="text-xs text-text-secondary">—</span>;
}

export default async function RatingPage({ searchParams }: { searchParams: Promise<{ p?: string; pw?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.p as Period) ? (sp.p as Period) : "month";
  const leader = isLeader(user);
  const data = await getRatingData({ period, employeeId: user.employee?.id ?? null });
  const myId = user.employee?.id ?? null;
  const firstName = (user.employee?.fullName ?? "").split(" ")[0] || "құрметті әріптес";

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      {sp.pw === "ok" && (
        <div className="rounded-card bg-[#e7f7ec] px-4 py-3 text-sm font-semibold text-[#16a34a]">✅ Пароль сәтті өзгертілді</div>
      )}

      <Hero data={data} firstName={firstName} leader={leader} />

      {leader && <LeaderKpis data={data} />}

      <Nominations data={data} myId={myId} />

      {data.me && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <SelfCard data={data} />
          <NearMe data={data} myId={myId!} />
        </div>
      )}

      {data.me && <Tip data={data} />}

      <Leaderboard data={data} myId={myId} leader={leader} period={period} />
    </div>
  );
}

function Hero({ data, firstName, leader }: { data: RatingData; firstName: string; leader: boolean }) {
  const t = new Date(data.today + "T00:00:00Z");
  const goal = data.team.goal;
  const pct = goal ? Math.min(100, Math.round((data.team.monthItems / goal.teamItems) * 100)) : 0;
  const me = data.me;
  return (
    <section
      className="rating-rise relative overflow-hidden rounded-[24px] px-6 py-5 text-white"
      style={{ background: "radial-gradient(900px 300px at 85% -40%, #3d7bff 0%, transparent 60%), linear-gradient(120deg,#0b1a45,#13286b)" }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Сәлем, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-[#a9b8e6]">
            {WEEKDAYS[t.getUTCDay()]}, {dayLabel(data.today)} ·{" "}
            {me
              ? me.todayItems > 0
                ? `Бүгін ${me.todayItems} тауар сатылды — жақсы бастадыңыз!`
                : "Бүгінгі бірінші сатылым сізден болсын 💪"
              : `Айдың соңына ${data.team.daysLeft} күн қалды`}
          </p>
          <div className="mt-4 max-w-xl">
            {goal ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>
                    🤝 <b>Команда мақсаты:</b> айына {goal.teamItems} тауар
                  </span>
                  <b>
                    {data.team.monthItems} / {goal.teamItems} · {pct}%
                  </b>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <i className="rating-bar block h-full rounded-full bg-gradient-to-r from-[#5ee38b] to-[#22c55e]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-[#a9b8e6]">
                  {data.team.monthItems >= goal.teamItems
                    ? "🎉 Мақсат орындалды!"
                    : `Тағы ${goal.teamItems - data.team.monthItems} тауар`}
                  {goal.reward ? ` — орындалса: ${goal.reward}` : ""}
                  {me ? ` · Сіздің үлесіңіз: ${me.monthItems} тауар` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#a9b8e6]">
                🤝 Команданың осы айғы мақсаты әлі қойылмаған{leader ? " — «Мақсаттар» бетінде қойыңыз" : ""}.
              </p>
            )}
          </div>
        </div>
        {me && (
          <div className="flex gap-3">
            <HeroStat label="Өткен айдан" value={me.growthPct === null ? "жаңа" : `${me.growthPct >= 0 ? "↑" : "↓"} ${Math.abs(me.growthPct)}%`} color={me.growthPct !== null && me.growthPct < 0 ? "#ffb4b4" : "#5ee38b"} />
            <HeroStat label="Серия" value={`${me.streak} күн${me.streak > 0 ? " 🔥" : ""}`} />
            <HeroStat label="Апталық орын" value={String(me.weekRank)} extra={<Change n={me.weekRankChange} />} />
          </div>
        )}
        {!me && leader && (
          <div className="flex gap-3">
            <HeroStat label="Ай · тауар" value={String(data.team.monthItems)} />
            <HeroStat label="Менеджер" value={String(data.board.length)} />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroStat({ label, value, color, extra }: { label: string; value: string; color?: string; extra?: React.ReactNode }) {
  return (
    <div className="min-w-[130px] rounded-[18px] border border-white/15 bg-white/10 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#a9b8e6]">{label}</div>
      <div className="mt-0.5 text-2xl font-extrabold" style={color ? { color } : undefined}>
        {value} {extra}
      </div>
    </div>
  );
}

function LeaderKpis({ data }: { data: RatingData }) {
  const tag = <span className="ml-1 rounded-full bg-[#fff4d6] px-1.5 py-0.5 text-[10px] font-bold text-[#8a5a00]">ТЕК CEO</span>;
  const items = [
    { l: "Команда сатты (ай)", v: money(data.team.monthRevenue), s: data.team.monthGrowthPct === null ? "" : `${data.team.monthGrowthPct >= 0 ? "↑" : "↓"} ${Math.abs(data.team.monthGrowthPct)}% өткен айдан`, ceo: true },
    { l: "Клиент қарызы", v: money(data.team.debt), s: "төленбеген қалдық", ceo: true, danger: true },
    { l: "Бонус қоры (ай)", v: money(data.team.bonus), s: `${data.board.length} менеджерге`, ceo: true },
    { l: "Орташа чек", v: money(data.team.avgCheck), s: "осы ай", ceo: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.l} className="rounded-[18px] bg-surface px-4 py-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
            {k.l}
            {k.ceo && tag}
          </div>
          <div className={`mt-1 text-xl font-extrabold ${k.danger ? "text-danger" : "text-text-primary"}`}>{k.v}</div>
          <div className="text-xs text-text-secondary">{k.s}</div>
        </div>
      ))}
    </div>
  );
}

const NOM_BG: Record<string, string> = { grower: "#22c55e", first: "#fff3cc", debtfree: "#e8efff", oldclient: "#ffe6e6", steady: "#f0e8ff" };

function Nominations({ data, myId }: { data: RatingData; myId: string | null }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-base font-bold text-text-primary">🏅 Апта номинациялары</h2>
        <span className="text-xs text-text-secondary">жеңудің 5 жолы — әр дүйсенбі жаңаланады</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {data.nominations.map((n, i) => {
          const mine = n.winnerEmployeeId !== null && n.winnerEmployeeId === myId;
          return (
            <div
              key={n.id}
              className={`rating-rise relative flex items-center gap-3 rounded-[20px] p-3.5 ${mine ? "bg-gradient-to-br from-[#e7f7ec] to-[#d2f3dd] outline outline-2 outline-[#22c55e]" : "bg-surface"}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {mine && <span className="absolute -top-2.5 right-3 rounded-full bg-[#16a34a] px-2 py-0.5 text-[11px] font-bold text-white">Сіз! 🎉</span>}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-xl" style={{ background: NOM_BG[n.id] }}>
                {n.emoji}
              </span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-text-secondary">{n.title}</div>
                <div className="truncate text-sm font-bold text-text-primary">{n.winner ?? "—"}</div>
                <div className="truncate text-xs text-text-secondary">{n.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelfCard({ data }: { data: RatingData }) {
  const me = data.me!;
  const max = Math.max(1, ...me.months.map((m) => m.revenue));
  const toRecord = me.record ? me.record.items - me.todayItems + 1 : null;
  return (
    <section className="flex flex-col rounded-[22px] bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">📈 Сіз vs өткен айдағы өзіңіз</h2>
        <span className="text-xs text-text-secondary">тек сізге көрінеді 🔒</span>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div>
          {me.growthPct === null ? (
            <div className="text-2xl font-extrabold text-[#1f4fd8]">Жаңа бастама 🚀</div>
          ) : (
            <div className={`text-5xl font-black tracking-tight ${me.growthPct < 0 ? "text-danger" : "text-[#16a34a]"}`}>
              {`${me.growthPct >= 0 ? "+" : ""}${me.growthPct}%`}
            </div>
          )}
          <div className="mt-1 text-sm text-text-secondary">
            Өткен айдың осы кезеңі {money(me.lastMonthSamePeriod)} → қазір {money(me.monthRevenue)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-text-secondary">
            <div className="rounded-xl bg-page-bg p-2">Бүгін<b className="block text-sm text-text-primary">{money(me.todayRevenue)}</b>{me.todayItems} тауар</div>
            <div className="rounded-xl bg-page-bg p-2">Апта<b className="block text-sm text-text-primary">{money(me.weekRevenue)}</b>{me.weekItems} тауар</div>
            <div className="rounded-xl bg-page-bg p-2">Ай<b className="block text-sm text-text-primary">{money(me.monthRevenue)}</b>{me.monthItems} тауар</div>
          </div>
        </div>
        <div className="flex h-[180px] flex-1 items-end gap-3">
          {me.months.map((m, i) => {
            const cur = i === me.months.length - 1;
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5 text-[11px] text-text-secondary">
                <i
                  className="rating-grow block w-full rounded-t-[10px] rounded-b-[4px]"
                  style={{
                    height: `${Math.max(6, (m.revenue / max) * 150)}px`,
                    background: cur ? `linear-gradient(180deg,#3d7bff,${BRAND})` : "#dbe5ff",
                    animationDelay: `${i * 80}ms`,
                  }}
                  title={money(m.revenue)}
                />
                <span className={cur ? "font-bold text-[#1f4fd8]" : ""}>{monthName(m.month)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-[#fff8e1] px-3 py-2.5 text-[13px]">
          🏆
          <span>
            {me.record ? (
              <>
                <b>Жеке рекорд:</b> бір күнде {me.record.items} тауар ({dayLabel(me.record.day)}). Бүгін — {me.todayItems}.
                {toRecord !== null && toRecord > 0 && (
                  <>
                    {" "}Тағы <b>{toRecord} тауар</b> — жаңа рекорд!
                  </>
                )}
              </>
            ) : (
              "Бірінші сатылымыңыз — бірінші рекордыңыз!"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-[14px] bg-[#e7f7ec] px-3 py-2.5 text-[13px]">
          💰 <span>Бонусым (ай): <b>{money(me.bonusMonth)}</b> 🔒</span>
        </div>
      </div>
    </section>
  );
}

function NearMe({ data, myId }: { data: RatingData; myId: string }) {
  const board = data.board;
  const idx = board.findIndex((r) => r.employeeId === myId);
  const start = Math.max(0, Math.min(idx - 3, board.length - 4));
  const slice = board.slice(start, start + 4);
  const me = board[idx];
  const above = idx > 0 ? board[idx - 1] : null;
  return (
    <section className="flex flex-col rounded-[22px] bg-surface p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">🏁 Рейтинг · {PERIOD_LABEL[data.period].toLowerCase()}</h2>
        <span className="text-xs text-text-secondary">маңайыңыздағылар</span>
      </div>
      {slice.map((r) => {
        const isMe = r.employeeId === myId;
        return (
          <div
            key={r.employeeId}
            className={`grid grid-cols-[24px_36px_1fr_auto_34px] items-center gap-2.5 px-1.5 py-2.5 text-sm ${isMe ? "rounded-[14px] bg-[#e7f7ec]" : "border-b border-border"}`}
          >
            <b style={{ color: isMe ? "#16a34a" : BRAND }}>{r.rank}</b>
            <Avatar name={r.name} size={34} me={isMe} />
            <div className="min-w-0">
              <b className="truncate">{isMe ? "Сіз" : r.name}</b>
              {isMe && above && (
                <div className="text-xs font-semibold text-[#16a34a]">
                  ↑ {above.rank}-орынға {money(Math.max(0, above.revenue - me.revenue))} қалды
                </div>
              )}
              {isMe && !above && <div className="text-xs font-semibold text-[#16a34a]">👑 Сіз көшбасшысыз!</div>}
            </div>
            <span className="text-right font-bold">{money(r.revenue)}</span>
            <span className="text-right text-text-secondary">{r.items}</span>
          </div>
        );
      })}
      <a href="#leaderboard" className="mt-auto rounded-[14px] bg-[#e8efff] p-2.5 text-center text-sm font-bold text-[#1f4fd8]">
        🏆 Толық рейтинг және подиум ↓
      </a>
    </section>
  );
}

function Tip({ data }: { data: RatingData }) {
  const me = data.me!;
  const team = data.team.avgCheck;
  let text: React.ReactNode;
  if (!me.avgCheck || !team) text = "Осы айдың алғашқы сатылымдарынан кейін мұнда сізге жеке кеңес шығады.";
  else if (me.avgCheck < team * 0.9)
    text = (
      <>
        Орташа чегіңіз <b>{money(me.avgCheck)}</b>, команданікі — <b>{money(team)}</b>. Салонмен бірге <b>багаж төсенішін</b> немесе{" "}
        <b>съемный полик</b> ұсынып көріңіз — чек тез өседі.
      </>
    );
  else
    text = (
      <>
        Орташа чегіңіз <b>{money(me.avgCheck)}</b> — команданың орташасынан ({money(team)}) жоғары 👏 Енді тауар санын арттыру — рейтингте жоғарылаудың ең жылдам жолы.
      </>
    );
  return (
    <section className="flex items-center gap-3.5 rounded-[20px] bg-gradient-to-r from-[#e8efff] to-[#f3f6ff] px-4 py-3.5 text-sm leading-relaxed text-text-primary">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white" style={{ background: BRAND }}>
        💡
      </span>
      <div>
        <b>Сізге кеңес:</b> {text}
      </div>
    </section>
  );
}

function Leaderboard({ data, myId, leader, period }: { data: RatingData; myId: string | null; leader: boolean; period: Period }) {
  const top = data.board.slice(0, 3);
  const rest = data.board.slice(3);
  const maxRev = Math.max(1, ...data.board.map((r) => r.revenue));
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean) as BoardRow[];
  const heights: Record<number, number> = { 1: 120, 2: 86, 3: 62 };
  const rings: Record<number, string> = { 1: "#ffcf4a", 2: "#d7dbe4", 3: "#e3a06f" };
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <section id="leaderboard" className="flex flex-col gap-4 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text-primary">🏆 Толық рейтинг</h2>
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/rating?p=${p}#leaderboard`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${p === period ? "text-white" : "text-text-secondary hover:text-text-primary"}`}
              style={p === period ? { background: BRAND } : undefined}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>

      {data.board.length === 0 ? (
        <div className="rounded-[22px] bg-surface p-8 text-center text-sm text-text-secondary">
          Әзірге менеджер тіркелмеген.{leader ? " «Менеджерлер» бетінде аккаунт ашыңыз." : ""}
        </div>
      ) : (
        <>
          <div
            className="flex items-end justify-center gap-4 overflow-hidden rounded-[24px] px-4 pt-6"
            style={{ background: "radial-gradient(1000px 360px at 50% -10%, #3b5bd8 0%, #13286b 55%, #0b1a45 100%)" }}
          >
            {podiumOrder.map((r) => (
              <div key={r.employeeId} className="rating-rise flex w-[200px] flex-col items-center text-center text-white" style={{ animationDelay: `${(r.rank - 1) * 120}ms` }}>
                {r.rank === 1 && <div className="-mb-1 text-3xl">👑</div>}
                <div className="relative">
                  <Avatar name={r.name} size={r.rank === 1 ? 92 : 72} me={r.employeeId === myId} ring={rings[r.rank]} />
                  <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0b1a45] text-base">
                    {medals[r.rank]}
                  </span>
                </div>
                <div className="mt-3 text-[17px] font-extrabold">{r.employeeId === myId ? `${r.name} (сіз)` : r.name}</div>
                <div className={`text-xl font-extrabold ${r.rank === 1 ? "text-[#ffd76a]" : ""}`}>{money(r.revenue)}</div>
                <div className="text-xs text-[#b9c6f0]">{r.items} тауар</div>
                <div
                  className="rating-grow mt-3 flex w-full justify-center rounded-t-2xl bg-gradient-to-b from-white/20 to-white/5 pt-2 text-3xl font-black text-white/85"
                  style={{ height: heights[r.rank] }}
                >
                  {r.rank}
                </div>
              </div>
            ))}
          </div>

          {rest.length > 0 && (
            <div className="overflow-x-auto rounded-[22px] bg-surface px-4 py-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Менеджер</th>
                    <th className="w-[35%] py-2 pr-2">Сатылым</th>
                    <th className="py-2 pr-2 text-right">Сома</th>
                    <th className="py-2 pr-2 text-right">Тауар</th>
                    {leader && <th className="py-2 pr-2 text-right">Бонус</th>}
                    {leader && <th className="py-2 pr-2 text-right">Қарыз</th>}
                    <th className="py-2 text-right">Өзгеріс</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((r) => {
                    const isMe = r.employeeId === myId;
                    return (
                      <tr key={r.employeeId} className={`border-t border-border ${isMe ? "bg-[#e7f7ec]" : ""}`}>
                        <td className="py-2.5 pr-2 font-bold" style={{ color: isMe ? "#16a34a" : BRAND }}>{r.rank}</td>
                        <td className="py-2.5 pr-2">
                          <span className="flex items-center gap-2.5 font-semibold">
                            <Avatar name={r.name} size={32} me={isMe} />
                            {isMe ? `${r.name} (сіз)` : r.name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="h-2.5 overflow-hidden rounded-full bg-page-bg">
                            <i className="rating-bar block h-full rounded-full bg-gradient-to-r from-[#3d7bff] to-[#1f4fd8]" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                          </div>
                        </td>
                        <td className="py-2.5 pr-2 text-right font-bold">{money(r.revenue)}</td>
                        <td className="py-2.5 pr-2 text-right text-text-secondary">
                          {r.items}
                          {r.goalItems ? <span className="text-xs"> / {r.goalItems}</span> : null}
                        </td>
                        {leader && <td className="py-2.5 pr-2 text-right">{money(r.bonus)}</td>}
                        {leader && <td className={`py-2.5 pr-2 text-right ${r.remainder > 0 ? "text-danger" : ""}`}>{money(r.remainder)}</td>}
                        <td className="py-2.5 text-right"><Change n={r.rankChange} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {leader && top.length > 0 && (
            <div className="overflow-x-auto rounded-[22px] bg-surface px-4 py-2">
              <div className="py-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                Үздік 3 · бонус пен қарыз <span className="ml-1 rounded-full bg-[#fff4d6] px-1.5 py-0.5 text-[10px] text-[#8a5a00]">ТЕК CEO</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {top.map((r) => (
                    <tr key={r.employeeId} className="border-t border-border">
                      <td className="py-2 pr-2 font-bold">{medals[r.rank]} {r.name}</td>
                      <td className="py-2 pr-2 text-right">{r.items}{r.goalItems ? ` / ${r.goalItems}` : ""} тауар</td>
                      <td className="py-2 pr-2 text-right">Бонус {money(r.bonus)}</td>
                      <td className={`py-2 text-right ${r.remainder > 0 ? "text-danger" : ""}`}>Қарыз {money(r.remainder)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
