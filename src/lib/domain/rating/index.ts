import "server-only";
import { prisma } from "@/lib/db";
import { MANAGER_ROLES } from "@/lib/access";

// Рейтинг — "Продажи" кестесінен (SalesLedgerRow) есептеледі.
// 1 жол = 1 тауар (Excel-дегідей). "Возврат" статусындағы жолдар есепке кірмейді.
// Уақыт белдеуі — Алматы (UTC+5); күн "YYYY-MM-DD" жолымен салыстырылады.

export type Period = "day" | "week" | "month" | "lastMonth" | "year";
export const PERIODS: Period[] = ["day", "week", "month", "lastMonth", "year"];

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
function todayYmd(now = new Date()) {
  return ymd(new Date(now.getTime() + TZ_OFFSET_MS));
}
function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function weekStart(day: string) {
  const dow = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7; // Дс=0
  return addDays(day, -dow);
}
function monthKey(day: string) {
  return day.slice(0, 7);
}
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** [from, to] — екеуі де қоса алынады. */
export function periodRange(period: Period, today: string): [string, string] {
  switch (period) {
    case "day":
      return [today, today];
    case "week":
      return [weekStart(today), today];
    case "month":
      return [monthKey(today) + "-01", today];
    case "lastMonth": {
      const pm = shiftMonth(monthKey(today), -1);
      return [pm + "-01", `${pm}-${String(daysInMonth(pm)).padStart(2, "0")}`];
    }
    case "year":
      return [today.slice(0, 4) + "-01-01", today];
  }
}
/** Өткен кезеңнің дәл сол ұзындықтағы бөлігі (салыстыру үшін). */
function previousRange(period: Period, today: string): [string, string] {
  switch (period) {
    case "day": {
      const y = addDays(today, -1);
      return [y, y];
    }
    case "week": {
      const ws = weekStart(today);
      return [addDays(ws, -7), addDays(today, -7)];
    }
    case "month": {
      const pm = shiftMonth(monthKey(today), -1);
      const day = Math.min(Number(today.slice(8, 10)), daysInMonth(pm));
      return [pm + "-01", `${pm}-${String(day).padStart(2, "0")}`];
    }
    case "lastMonth": {
      const pm = shiftMonth(monthKey(today), -2);
      return [pm + "-01", `${pm}-${String(daysInMonth(pm)).padStart(2, "0")}`];
    }
    case "year": {
      const py = String(Number(today.slice(0, 4)) - 1);
      return [py + "-01-01", py + today.slice(4)];
    }
  }
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("ru");

interface Sale {
  day: string;
  key: string; // менеджер атының нормаланған түрі
  item: boolean;
  revenue: number;
  remainder: number;
  bonus: number;
  oldClient: boolean;
  createdAt: Date;
}

interface Agg {
  items: number;
  revenue: number;
  remainder: number;
  bonus: number;
  orders: number;
}
const emptyAgg = (): Agg => ({ items: 0, revenue: 0, remainder: 0, bonus: 0, orders: 0 });

function aggregate(sales: Sale[], from: string, to: string) {
  const map = new Map<string, Agg>();
  for (const s of sales) {
    if (s.day < from || s.day > to) continue;
    const a = map.get(s.key) ?? emptyAgg();
    if (s.item) a.items += 1;
    a.revenue += s.revenue;
    a.remainder += s.remainder;
    a.bonus += s.bonus;
    if (s.revenue > 0) a.orders += 1;
    map.set(s.key, a);
  }
  return map;
}

function rankOf(map: Map<string, Agg>, keys: string[]) {
  const sorted = [...keys].sort(
    (a, b) => (map.get(b)?.revenue ?? 0) - (map.get(a)?.revenue ?? 0) || (map.get(b)?.items ?? 0) - (map.get(a)?.items ?? 0)
  );
  return new Map(sorted.map((k, i) => [k, i + 1]));
}

export interface BoardRow {
  employeeId: string;
  name: string;
  key: string;
  rank: number;
  rankChange: number; // + көтерілді, - түсті
  items: number;
  revenue: number;
  bonus: number;
  remainder: number;
  avgCheck: number;
  goalItems: number | null;
}

export interface Nomination {
  id: string;
  emoji: string;
  title: string;
  winner: string | null;
  winnerEmployeeId: string | null;
  detail: string;
}

export async function getRatingData(opts: { period: Period; employeeId: string | null; now?: Date }) {
  const today = todayYmd(opts.now);
  const thisMonth = monthKey(today);
  const historyFrom = [shiftMonth(thisMonth, -5) + "-01", String(Number(today.slice(0, 4)) - 1) + "-01-01"].sort()[0];

  const [employees, rows, goal] = await Promise.all([
    prisma.employee.findMany({
      where: {
        user: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...MANAGER_ROLES] } } } } },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.salesLedgerRow.findMany({
      where: {
        OR: [{ date: { gte: new Date(historyFrom + "T00:00:00Z") } }, { date: null, createdAt: { gte: new Date(historyFrom) } }],
      },
      select: {
        date: true,
        manager: true,
        product: true,
        soldFor: true,
        remainder: true,
        managerBonus: true,
        contactChannel: true,
        orderStatus: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
      },
    }),
    prisma.salesGoal.findUnique({ where: { month: thisMonth }, include: { personal: true } }),
  ]);

  const sales: Sale[] = [];
  for (const r of rows) {
    if (/возврат/i.test(r.orderStatus ?? "")) continue;
    const day = r.date ? ymd(r.date) : todayYmd(r.createdAt);
    sales.push({
      day,
      key: norm(r.manager) || norm(r.createdBy?.fullName),
      item: Boolean(r.product && r.product.trim()),
      revenue: Number(r.soldFor ?? 0),
      remainder: Math.max(0, Number(r.remainder ?? 0)),
      bonus: Number(r.managerBonus ?? 0),
      oldClient: /ескі|старый|повтор/i.test(r.contactChannel ?? ""),
      createdAt: r.createdAt,
    });
  }

  const people = employees.map((e) => ({ id: e.id, name: e.fullName, key: norm(e.fullName) }));
  const keys = people.map((p) => p.key);
  const personalGoal = new Map(goal?.personal.map((p) => [p.employeeId, p.items]) ?? []);

  // ---- Таңдалған кезең бойынша рейтинг ----
  const [from, to] = periodRange(opts.period, today);
  const [pFrom, pTo] = previousRange(opts.period, today);
  const cur = aggregate(sales, from, to);
  const prev = aggregate(sales, pFrom, pTo);
  const curRank = rankOf(cur, keys);
  const prevRank = rankOf(prev, keys);

  const board: BoardRow[] = people
    .map((p) => {
      const a = cur.get(p.key) ?? emptyAgg();
      return {
        employeeId: p.id,
        name: p.name,
        key: p.key,
        rank: curRank.get(p.key)!,
        rankChange: (prevRank.get(p.key) ?? 0) - curRank.get(p.key)!,
        items: a.items,
        revenue: a.revenue,
        bonus: a.bonus,
        remainder: a.remainder,
        avgCheck: a.orders ? Math.round(a.revenue / a.orders) : 0,
        goalItems: personalGoal.get(p.id) ?? null,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  // Команда (кезеңге қарамай — ағымдағы ай; мақсат айлық)
  const monthAgg = aggregate(sales, thisMonth + "-01", today);
  let teamMonthItems = 0;
  let teamMonthRevenue = 0;
  let teamMonthOrders = 0;
  let teamDebt = 0;
  let teamBonus = 0;
  for (const a of monthAgg.values()) {
    teamMonthItems += a.items;
    teamMonthRevenue += a.revenue;
    teamMonthOrders += a.orders;
    teamDebt += a.remainder;
    teamBonus += a.bonus;
  }
  const [lmFrom, lmTo] = previousRange("month", today);
  let lastMonthSamePeriodRevenue = 0;
  for (const a of aggregate(sales, lmFrom, lmTo).values()) lastMonthSamePeriodRevenue += a.revenue;

  // Өткен айдың қорытындысы (толық ай) — чемпион
  const [lmFullFrom, lmFullTo] = periodRange("lastMonth", today);
  const lmFull = aggregate(sales, lmFullFrom, lmFullTo);
  const lmRank = rankOf(lmFull, keys);
  const champKey = keys.find((k) => lmRank.get(k) === 1 && (lmFull.get(k)?.revenue ?? 0) > 0);
  const lastMonthChampion = champKey
    ? {
        name: people.find((p) => p.key === champKey)!.name,
        employeeId: people.find((p) => p.key === champKey)!.id,
        month: monthKey(lmFullFrom),
        revenue: lmFull.get(champKey)!.revenue,
        items: lmFull.get(champKey)!.items,
      }
    : null;

  const team = {
    monthItems: teamMonthItems,
    monthRevenue: teamMonthRevenue,
    monthGrowthPct: lastMonthSamePeriodRevenue ? Math.round(((teamMonthRevenue - lastMonthSamePeriodRevenue) / lastMonthSamePeriodRevenue) * 100) : null,
    debt: teamDebt,
    bonus: teamBonus,
    avgCheck: teamMonthOrders ? Math.round(teamMonthRevenue / teamMonthOrders) : 0,
    goal: goal ? { teamItems: goal.teamItems, reward: goal.reward } : null,
    daysLeft: daysInMonth(thisMonth) - Number(today.slice(8, 10)),
  };

  // ---- Апта номинациялары (әр дүйсенбі жаңаланады) ----
  const ws = weekStart(today);
  const week = aggregate(sales, ws, today);
  const lastWeek = aggregate(sales, addDays(ws, -7), addDays(today, -7));
  const byKey = new Map(people.map((p) => [p.key, p]));
  const pick = (score: (k: string) => number, min = 1) => {
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const k of keys) {
      const s = score(k);
      if (s >= min && s > bestScore) {
        best = k;
        bestScore = s;
      }
    }
    return best ? { key: best, score: bestScore } : null;
  };
  const weekSales = sales.filter((s) => s.day >= ws && s.day <= today);

  const grower = pick((k) => {
    const c = week.get(k)?.items ?? 0;
    const p = lastWeek.get(k)?.items ?? 0;
    return p > 0 && c >= 3 ? ((c - p) / p) * 100 : -Infinity;
  }, 1);
  const firstSale = pick((k) => {
    // Күн сайын бірінші енгізілген сатылым (сайтта енгізілген жолдар бойынша)
    let n = 0;
    const days = new Set(weekSales.map((s) => s.day));
    for (const d of days) {
      const first = weekSales.filter((s) => s.day === d && todayYmd(s.createdAt) === d).sort((a, b) => +a.createdAt - +b.createdAt)[0];
      if (first?.key === k) n++;
    }
    return n;
  });
  const debtFree = pick((k) => {
    const m = monthAgg.get(k);
    return m && m.items > 0 && m.remainder === 0 ? m.items : -Infinity;
  });
  const oldClients = pick((k) => weekSales.filter((s) => s.key === k && s.oldClient).length);
  const steady = pick((k) => new Set(weekSales.filter((s) => s.key === k && s.item).map((s) => s.day)).size);

  const nom = (id: string, emoji: string, title: string, w: { key: string; score: number } | null, detail: (s: number, k: string) => string): Nomination => ({
    id,
    emoji,
    title,
    winner: w ? byKey.get(w.key)!.name : null,
    winnerEmployeeId: w ? byKey.get(w.key)!.id : null,
    detail: w ? detail(w.score, w.key) : "Әзірге ешкім",
  });
  const nominations: Nomination[] = [
    nom("grower", "🚀", "Ең көп өскен", grower, (s, k) => `+${Math.round(s)}% · ${lastWeek.get(k)?.items ?? 0} → ${week.get(k)?.items ?? 0} тауар`),
    nom("first", "⚡", "Бірінші сатылым", firstSale, (s) => `${s} рет күннің біріншісі`),
    nom("debtfree", "💯", "Қарызсыз", debtFree, (s) => `${s} тауар · 0 ₸ қалдық`),
    nom("oldclient", "🔁", "Ескі клиент", oldClients, (s) => `${s} ескі клиент қайтты`),
    nom("steady", "🎯", "Тұрақты", steady, (s) => `${s}/${(new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7 + 1} күн сатылым`),
  ];

  // ---- Жеке көрсеткіштер (тек менеджердің өзіне) ----
  let me = null as null | {
    name: string;
    todayItems: number;
    todayRevenue: number;
    weekItems: number;
    weekRevenue: number;
    monthItems: number;
    monthRevenue: number;
    lastMonthSamePeriod: number;
    growthPct: number | null;
    streak: number;
    record: { items: number; day: string } | null;
    months: Array<{ month: string; revenue: number }>;
    weekRank: number;
    weekRankChange: number;
    monthRank: number;
    avgCheck: number;
    goalItems: number | null;
    bonusMonth: number;
  };
  const mePerson = people.find((p) => p.id === opts.employeeId);
  if (mePerson) {
    const k = mePerson.key;
    const mine = sales.filter((s) => s.key === k);
    const dayItems = new Map<string, number>();
    for (const s of mine) if (s.item) dayItems.set(s.day, (dayItems.get(s.day) ?? 0) + 1);
    let streak = 0;
    let d = dayItems.has(today) ? today : addDays(today, -1);
    while (dayItems.has(d)) {
      streak++;
      d = addDays(d, -1);
    }
    let record: { items: number; day: string } | null = null;
    for (const [day, n] of dayItems) if (!record || n > record.items) record = { items: n, day };

    const months = [-4, -3, -2, -1, 0].map((n) => {
      const m = shiftMonth(thisMonth, n);
      return { month: m, revenue: mine.filter((s) => monthKey(s.day) === m).reduce((t, s) => t + s.revenue, 0) };
    });
    const lm = aggregate(mine, lmFrom, lmTo).get(k)?.revenue ?? 0;
    const mAgg = monthAgg.get(k) ?? emptyAgg();
    const wAgg = week.get(k) ?? emptyAgg();
    const tAgg = aggregate(mine, today, today).get(k) ?? emptyAgg();
    const weekRank = rankOf(week, keys).get(k)!;
    const lastWeekRank = rankOf(lastWeek, keys).get(k)!;
    me = {
      name: mePerson.name,
      todayItems: tAgg.items,
      todayRevenue: tAgg.revenue,
      weekItems: wAgg.items,
      weekRevenue: wAgg.revenue,
      monthItems: mAgg.items,
      monthRevenue: mAgg.revenue,
      lastMonthSamePeriod: lm,
      growthPct: lm ? Math.round(((mAgg.revenue - lm) / lm) * 100) : null,
      streak,
      record,
      months,
      weekRank,
      weekRankChange: lastWeekRank - weekRank,
      monthRank: rankOf(monthAgg, keys).get(k)!,
      avgCheck: mAgg.orders ? Math.round(mAgg.revenue / mAgg.orders) : 0,
      goalItems: personalGoal.get(mePerson.id) ?? null,
      bonusMonth: mAgg.bonus,
    };
  }

  return { today, period: opts.period, range: [from, to] as const, board, team, nominations, me, lastMonthChampion };
}

export type RatingData = Awaited<ReturnType<typeof getRatingData>>;
