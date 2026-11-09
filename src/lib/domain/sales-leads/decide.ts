/**
 * Лидтер ережелерінің ТАЗА бөлігі (базаға тәуелсіз — тесттер осыны тексереді).
 *
 * Ереже 1: Продажиде ОЛХ сатылымы сақталса → соңғы 90 күндегі лидті телефон бойынша тауып байланыстыру
 *   (күйі «Сатылды»); табылмаса — лид өзі жасалады. Дубль болмайды:
 *   - лид осы жолмен бұрын байланысқан болса → ештеңе;
 *   - бір тапсырыс бірнеше жолға бөлінген (сол телефон, сол күн, лид басқа жолмен «Сатылды») → ештеңе.
 */
export const LOOKBACK_DAYS = 90;
const DAY = 86400_000;

export type SaleForLink = { id: string; phoneNorm: string | null; channelCode: string | null; date: Date | null };
export type LeadForLink = {
  id: string;
  account: string;
  date: Date;
  status: "NEW" | "IN_PROGRESS" | "SOLD" | "LOST";
  ledgerRowId: string | null;
  soldAt: Date | null;
};
export type LinkDecision =
  | { action: "none"; why: "not-olx" | "no-phone" | "no-date" | "already-linked" | "same-order" }
  | { action: "link"; leadId: string }
  | { action: "create" };

export const OLX_CODES = new Set(["OLX_1", "OLX_2", "OLX_UNKNOWN"]);
const dayKey = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10); // Алматы күні

export function decideOlxLink(sale: SaleForLink, leads: LeadForLink[], opts: { allowCreate?: boolean } = {}): LinkDecision {
  if (!sale.channelCode || !OLX_CODES.has(sale.channelCode)) return { action: "none", why: "not-olx" };
  if (!sale.phoneNorm) return { action: "none", why: "no-phone" };
  if (!sale.date) return { action: "none", why: "no-date" };
  const t = sale.date.getTime();
  const window = leads.filter((l) => l.date.getTime() >= t - LOOKBACK_DAYS * DAY && l.date.getTime() <= t + DAY);

  if (window.some((l) => l.ledgerRowId === sale.id)) return { action: "none", why: "already-linked" };
  const saleDay = dayKey(sale.date);
  if (window.some((l) => l.status === "SOLD" && l.ledgerRowId && l.soldAt && dayKey(l.soldAt) === saleDay))
    return { action: "none", why: "same-order" };

  const open = window.filter((l) => l.status !== "SOLD" && !l.ledgerRowId);
  if (open.length) {
    // Аккаунты сәйкес келетінге басымдық, сосын ең соңғы лид
    const sameAcc = open.filter((l) => l.account === sale.channelCode);
    const pool = sameAcc.length ? sameAcc : open;
    const best = pool.reduce((a, b) => (b.date.getTime() > a.date.getTime() ? b : a));
    return { action: "link", leadId: best.id };
  }
  return opts.allowCreate === false ? { action: "none", why: "same-order" } : { action: "create" };
}

/**
 * Кестеден жаңа лид келгенде: сол телефонмен сатылымнан өзі жасалған лид (autoCreated, кестеде жоқ)
 * бар болса — жаңасын жасамай, соған біріктіреміз (дубль болмасын).
 * Шарт: авто-лид сатылымының күні жаңа лид күнінен кейін, 90 күн ішінде.
 */
export type AutoLead = { id: string; phoneNorm: string | null; soldAt: Date | null; importKey: string | null; autoCreated: boolean };
export function findAutoLeadToMerge(lead: { phoneNorm: string | null; date: Date }, autos: AutoLead[]): string | null {
  if (!lead.phoneNorm) return null;
  const t = lead.date.getTime();
  const hit = autos.find(
    (a) =>
      a.autoCreated &&
      !a.importKey &&
      a.phoneNorm === lead.phoneNorm &&
      a.soldAt &&
      a.soldAt.getTime() >= t - DAY &&
      a.soldAt.getTime() <= t + LOOKBACK_DAYS * DAY
  );
  return hit?.id ?? null;
}
