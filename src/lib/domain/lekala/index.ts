import "server-only";
import { prisma } from "@/lib/db";
import { canUseWorkshop, WORKSHOP_ROLES } from "@/lib/access";
import { isChecked } from "@/lib/domain/sales-ledger/sheet-layout";
import { sendPushToUsers } from "@/lib/push";
import type { SessionUser } from "@/lib/session";
import { lekalaKey, lekalaVerdict, yearsText, type LekalaHistory, type LekalaVerdict } from "./calc";

/**
 * Лекала (CEO, 2026-11-19): менеджер марка+модельді жазғанда «бар / жоқ» өзі шығады.
 * Дерек: цех тарихы (Продажи «Цех ✓» — бұрын тіктік → лекала бар) + цех/CEO белгісі + «Цехтан сұрау».
 */

export class LekalaError extends Error {}

type Hist = LekalaHistory & { make: string; model: string };

let cache: { at: number; map: Map<string, Hist> } | null = null;
const TTL = 10 * 60_000;

/** Тарих индексі: кілт → неше рет тіктік, қай жылдар, соңғысы. 10 минут кэште. */
export async function historyIndex(force = false): Promise<Map<string, Hist>> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.map;
  const rows = await prisma.salesLedgerRow.findMany({ select: { car: true, brand: true, carYear: true, workshop: true, date: true } });
  const map = new Map<string, Hist>();
  for (const r of rows) {
    if (!isChecked(r.workshop)) continue;
    const k = lekalaKey(r.car, r.brand);
    if (!k) continue;
    const h = map.get(k.key) ?? { make: k.make, model: k.model, count: 0, minYear: null, maxYear: null, last: null };
    h.count++;
    if (r.carYear && r.carYear > 1980 && r.carYear < 2100) {
      h.minYear = h.minYear == null ? r.carYear : Math.min(h.minYear, r.carYear);
      h.maxYear = h.maxYear == null ? r.carYear : Math.max(h.maxYear, r.carYear);
    }
    const d = r.date?.toISOString().slice(0, 10) ?? null;
    if (d && (!h.last || d > h.last)) h.last = d;
    map.set(k.key, h);
  }
  cache = { at: Date.now(), map };
  return map;
}

async function nameOf(user: SessionUser) {
  return user.employee?.id ? (await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } }))?.fullName ?? null : null;
}

export interface LekalaLookup {
  make: string;
  model: string;
  year: number | null;
  verdict: LekalaVerdict;
  request: { id: string; status: string; by: string | null; at: string; answeredBy: string | null } | null;
}

/** Жаңа заказ формасы: марка+модель (+жыл) бойынша лекала бар-жоғы. Кез келген кірген қолданушыға. */
export async function lookupLekala(make: string, model: string, year?: number | null): Promise<LekalaLookup | null> {
  const k = lekalaKey(make, model);
  if (!k) return null;
  const [hist, mark, req] = await Promise.all([
    historyIndex(),
    prisma.lekalaMark.findUnique({ where: { key: k.key } }),
    prisma.lekalaRequest.findFirst({ where: { key: k.key }, orderBy: { createdAt: "desc" } }),
  ]);
  const open = req && (req.status === "OPEN" || req.status === "SEARCHING") ? { by: req.requestedByName } : null;
  const y = year && year > 1980 && year < 2100 ? year : null;
  return {
    make: k.make,
    model: k.model,
    year: y,
    verdict: lekalaVerdict(hist.get(k.key) ?? null, mark, open, y),
    request: req
      ? { id: req.id, status: req.status, by: req.requestedByName, at: req.createdAt.toISOString(), answeredBy: req.answeredByName }
      : null,
  };
}

async function workshopUserIds() {
  const us = await prisma.user.findMany({
    where: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...WORKSHOP_ROLES] } } } } },
    select: { id: true },
  });
  return us.map((u) => u.id);
}

async function notify(userIds: string[], type: string, title: string, body: string, url: string, tag: string) {
  if (!userIds.length) return;
  await prisma.notification.createMany({ data: userIds.map((recipientId) => ({ recipientId, type, title, body, payload: { url } })) });
  await sendPushToUsers(userIds, { title, body, url, tag }).catch((e) => console.error("[lekala] push", e instanceof Error ? e.message : e));
}

/** Менеджер: «Цехтан сұрау». Сол көлікке ашық сұрау болса — жаңасы ашылмайды. Цехқа хабар (сайт + телефон). */
export async function requestLekala(user: SessionUser, make: string, model: string, year?: number | null) {
  const k = lekalaKey(make, model);
  if (!k) throw new LekalaError("Марка мен модельді жазыңыз");
  const existing = await prisma.lekalaRequest.findFirst({ where: { key: k.key, status: { in: ["OPEN", "SEARCHING"] } } });
  if (existing) return existing;
  const who = await nameOf(user);
  const y = year && year > 1980 && year < 2100 ? year : null;
  const req = await prisma.lekalaRequest.create({
    data: { key: k.key, make: k.make, model: k.model, year: y, requestedById: user.id, requestedByName: who },
  });
  const car = `${k.make} ${k.model}${y ? ` ${y}` : ""}`;
  await notify(await workshopUserIds(), "lekala.request", `Лекала бар ма? ${car}`, `${who ?? "Менеджер"} сұрайды`, `/lekala?req=${req.id}`, `lekala-${req.id}`);
  return req;
}

export type LekalaAnswer = "HAVE" | "NONE" | "SEARCHING";

function assertWorkshop(user: SessionUser) {
  if (!canUseWorkshop(user)) throw new LekalaError("Лекаланы тек цех немесе CEO белгілей алады");
}

/** Цех: сұрауға жауап. «Бар/Жоқ» — белгі болып сақталады (келесі жолы сұралмайды); сұраушыға хабар. */
export async function answerLekala(user: SessionUser, requestId: string, answer: LekalaAnswer) {
  assertWorkshop(user);
  if (!["HAVE", "NONE", "SEARCHING"].includes(answer)) throw new LekalaError("Жауап дұрыс емес");
  const req = await prisma.lekalaRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new LekalaError("Сұрау табылмады");
  if (answer === "SEARCHING") {
    const who = await nameOf(user);
    await prisma.lekalaRequest.update({ where: { id: req.id }, data: { status: "SEARCHING", answeredById: user.id, answeredByName: who, answeredAt: new Date() } });
    if (req.requestedById) await notify([req.requestedById], "lekala.answer", `Лекала іздеп жатыр: ${req.make} ${req.model}`, `${who ?? "Цех"} csj918-ден іздеп жатыр`, "/orders/new", `lekala-${req.id}`);
    return;
  }
  await setMark(user, req.make, req.model, answer);
}

/** Цех/CEO: көлікке «бар» / «жоқ» белгісі. Сол көлік бойынша ашық сұраулар жабылып, сұраушыларға хабар барады. */
export async function setMark(user: SessionUser, make: string, model: string, status: "HAVE" | "NONE") {
  assertWorkshop(user);
  const k = lekalaKey(make, model);
  if (!k) throw new LekalaError("Марка мен модельді жазыңыз");
  const who = await nameOf(user);
  await prisma.lekalaMark.upsert({
    where: { key: k.key },
    update: { status, byId: user.id, byName: who, make: k.make, model: k.model },
    create: { key: k.key, make: k.make, model: k.model, status, byId: user.id, byName: who },
  });
  const open = await prisma.lekalaRequest.findMany({ where: { key: k.key, status: { in: ["OPEN", "SEARCHING"] } } });
  if (open.length) {
    await prisma.lekalaRequest.updateMany({
      where: { id: { in: open.map((r) => r.id) } },
      data: { status, answeredById: user.id, answeredByName: who, answeredAt: new Date() },
    });
    const ids = [...new Set(open.map((r) => r.requestedById).filter((x): x is string => !!x))];
    const title = status === "HAVE" ? `✓ Лекала бар: ${k.make} ${k.model}` : `✗ Лекала жоқ: ${k.make} ${k.model}`;
    await notify(ids, "lekala.answer", title, `${who ?? "Цех"} жауап берді`, "/orders/new", `lekala-${k.key}`);
  }
}

export type LekalaFilter = "all" | "have" | "asked" | "none";

export interface LekalaRow {
  key: string;
  make: string;
  model: string;
  status: "have" | "none" | "asked";
  count: number;
  years: string | null;
  last: string | null;
  source: string;
  request: { id: string; by: string | null; at: string; year: number | null; status: string } | null;
}

/** «Лекала» беті (цех, CEO): тарих + белгілер + ашық сұраулар. */
export async function listLekala(user: SessionUser, opts: { filter?: LekalaFilter; q?: string } = {}) {
  assertWorkshop(user);
  const [hist, marks, reqs] = await Promise.all([
    historyIndex(),
    prisma.lekalaMark.findMany(),
    prisma.lekalaRequest.findMany({ where: { status: { in: ["OPEN", "SEARCHING"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const rows = new Map<string, LekalaRow>();
  for (const [key, h] of hist) {
    rows.set(key, { key, make: h.make, model: h.model, status: "have", count: h.count, years: yearsText(h), last: h.last, source: "Тарих", request: null });
  }
  for (const m of marks) {
    const r = rows.get(m.key) ?? { key: m.key, make: m.make, model: m.model, status: "have" as const, count: 0, years: null, last: null, source: "", request: null };
    r.status = m.status === "HAVE" ? "have" : "none";
    r.source = `${m.byName ?? "Цех"} белгіледі`;
    rows.set(m.key, r);
  }
  for (const q of reqs) {
    if (!rows.has(q.key)) rows.set(q.key, { key: q.key, make: q.make, model: q.model, status: "asked", count: 0, years: null, last: null, source: "", request: null });
    const r = rows.get(q.key)!;
    if (!r.request) {
      r.request = { id: q.id, by: q.requestedByName, at: q.createdAt.toISOString(), year: q.year, status: q.status };
      if (r.status !== "have") r.status = "asked";
    }
  }
  const all = [...rows.values()];
  const counts = {
    all: all.length,
    have: all.filter((r) => r.status === "have").length,
    asked: all.filter((r) => r.request).length,
    none: all.filter((r) => r.status === "none").length,
    sewn: all.reduce((s, r) => s + r.count, 0),
  };
  const q = (opts.q ?? "").trim().toLowerCase();
  const list = all
    .filter((r) => !opts.filter || opts.filter === "all" || (opts.filter === "asked" ? !!r.request : r.status === opts.filter))
    .filter((r) => !q || `${r.make} ${r.model}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.request) - Number(!!a.request) || b.count - a.count || a.make.localeCompare(b.make));
  return { rows: list.slice(0, 400), total: list.length, counts };
}
