// «Заказдар» бетіндегі ортақ тізім (сайт заказдары + Google/Продажи ескі жолдары) — таза функциялар.

/** Іздеу мәтінінен телефон бөлігін шығарады: «8 701 555» → ["8701555", "701555"]. Цифр аз болса — бос. */
export function phoneNeedles(q: string): string[] {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 4) return [];
  const out = [digits];
  if ((digits.startsWith("8") || digits.startsWith("7")) && digits.length >= 5) out.push(digits.slice(1));
  return [...new Set(out)];
}

/** Мәтін іздеуі: телефонсыз сөз бөлігі (кемінде 2 әріп). */
export function textNeedle(q: string): string | null {
  const s = q.trim();
  if (/^[\d\s+()-]+$/.test(s)) return null;
  return s.length >= 2 ? s.slice(0, 80) : null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("ru");

/** Продажи жолы осы менеджердікі ме: «Менеджер» бағаны аты бойынша немесе жолды өзі енгізген. */
export function isOwnLedgerRow(row: { manager: string | null; createdById: string | null }, me: { employeeId?: string | null; fullName?: string | null }): boolean {
  if (me.employeeId && row.createdById === me.employeeId) return true;
  const n = norm(me.fullName);
  return n !== "" && norm(row.manager) === n;
}

/** Чектердің қосындысы (төленген). */
export function paidOf(row: { receipt1Amount?: unknown; receipt2Amount?: unknown; receipt3Amount?: unknown }): number {
  return [row.receipt1Amount, row.receipt2Amount, row.receipt3Amount].reduce<number>((s, v) => s + (Number(v ?? 0) || 0), 0);
}

/** Телефонды көрсету: «7015551234» / «+77015551234» → «+7 701 555 12 34». */
export function formatPhone(p: string | null | undefined): string {
  const d = (p ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && (d[0] === "7" || d[0] === "8") ? d.slice(1) : d.length === 10 ? d : null;
  if (!ten) return p ?? "";
  return `+7 ${ten.slice(0, 3)} ${ten.slice(3, 6)} ${ten.slice(6, 8)} ${ten.slice(8)}`;
}

export type OrderPeriod = "today" | "yesterday" | "week" | "month" | "all";
export const ORDER_PERIODS: OrderPeriod[] = ["today", "yesterday", "week", "month", "all"];

const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Алматы бойынша бүгінгі күн (YYYY-MM-DD). */
export const almatyToday = (now = new Date()) => new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/** Кезең → [бастап, дейін] күндері (Алматы). Апта — дүйсенбіден (рейтингтегідей), ай — 1-күннен. «all» → null. */
export function periodDays(period: OrderPeriod, today: string): [string, string] | null {
  switch (period) {
    case "today":
      return [today, today];
    case "yesterday": {
      const y = addDays(today, -1);
      return [y, y];
    }
    case "week": {
      const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
      return [addDays(today, -dow), today];
    }
    case "month":
      return [today.slice(0, 8) + "01", today];
    default:
      return null;
  }
}

/** Кестедегі тауар атауын қысқарту: «3727 - Чехол - Style Z» → «Чехол - Style Z», «- - панель накидка» → «панель накидка». */
export function shortProduct(p: string | null | undefined): string {
  return (p ?? "")
    .trim()
    .replace(/^\d+\s*-\s*/, "")
    .replace(/^(-\s*)+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Продажи жолдарын «заказға» топтау кілті: бір күн + бір клиент (телефон/аты) + бір менеджер. */
export function ledgerGroupKey(r: { date: Date | null; phoneNorm: string | null; customerName: string | null; manager: string | null }): string {
  return [r.date ? r.date.toISOString().slice(0, 10) : "-", r.phoneNorm ?? "", (r.customerName ?? "").trim().toLowerCase(), (r.manager ?? "").trim().toLowerCase()].join("|");
}

/** «№12460–12464» немесе «№12443» (нөмірлер қатар болмаса — «№12460, 12462…»). */
export function ledgerLabel(nos: number[]): string {
  const s = [...new Set(nos)].sort((a, b) => a - b);
  if (s.length === 0) return "";
  if (s.length === 1) return `№${s[0]}`;
  const consecutive = s.every((n, i) => i === 0 || n === s[i - 1] + 1);
  return consecutive ? `№${s[0]}–${s[s.length - 1]}` : `№${s.slice(0, 2).join(", ")}${s.length > 2 ? "…" : ""}`;
}

/**
 * Google/Продажи жолының «түскен уақыты»: кестеде тек күн бар, сондықтан сол күнге (Алматы) сәйкес келетін
 * ең ерте уақытты аламыз — жолдың сайтқа түскен уақыты (синхрон ~2 мин) немесе 1-чектің уақыты. Сәйкес келмесе — null
 * (мыс. ескі жолдар бір күнде жаппай импортталған).
 */
export function pickLedgerTime(day: Date | null, candidates: (Date | null | undefined)[]): Date | null {
  if (!day) return null;
  const want = day.toISOString().slice(0, 10);
  const ok = candidates.filter(
    (d): d is Date =>
      !!d &&
      // тек күні жазылған чек (UTC 00:00) — уақыты белгісіз, алмаймыз
      d.toISOString().slice(11, 19) !== "00:00:00" &&
      new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10) === want
  );
  return ok.length ? new Date(Math.min(...ok.map((d) => d.getTime()))) : null;
}

/** Кестедегі «№» бойынша іздеу: «12459» / «№12459» / «№ 12459» → 12459. 1–6 цифр болмаса — null. */
export function rowNoNeedle(q: string): number | null {
  const m = q.trim().match(/^(?:№|no\.?|n)?\s*(\d{1,6})$/i);
  return m ? Number(m[1]) : null;
}
