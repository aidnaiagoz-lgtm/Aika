import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { isLeader } from "@/lib/access";
import type { SessionUser } from "@/lib/session";
import { LEDGER_COLUMNS } from "../fields";
import { toSheetValues, appsScript } from "./format";

export { isPushedCopy } from "./format";

// Баптаулар (AppSetting): веб-қосымша URL-і, құпия токен, қосылған уақыт
const K_URL = "sales.sheetPush.url";
const K_TOKEN = "sales.sheetPush.token";
const K_SINCE = "sales.sheetPush.since";
const COLS = LEDGER_COLUMNS.map((c) => ({ name: c.name, type: c.type }));

async function get(key: string) {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
}
async function put(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function sheetPushConfig() {
  const [url, token, since] = await Promise.all([get(K_URL), get(K_TOKEN), get(K_SINCE)]);
  return { url, token, since: since ? new Date(since) : null, enabled: !!(url && token && since) };
}

/** CEO үшін: токен (жоқ болса жасалады) және соған сай Apps Script мәтіні. */
export async function sheetPushSetup(user: SessionUser) {
  if (!isLeader(user)) throw new Error("Тек CEO / РОП");
  let token = await get(K_TOKEN);
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await put(K_TOKEN, token);
  }
  const cfg = await sheetPushConfig();
  return { script: appsScript(token), url: cfg.url, enabled: cfg.enabled, since: cfg.since?.toISOString() ?? null };
}

async function call(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script — CORS preflight-сыз
    body: JSON.stringify(body),
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as { ok: boolean; error?: string; row?: number; no?: number | string; sheet?: boolean };
  } catch {
    throw new Error(res.ok ? "Скрипт JSON қайтармады — «Web app», «Anyone» рұқсатымен деплой жасалды ма?" : `Скрипт жауабы ${res.status}`);
  }
}

/** URL-ді тексеріп сақтау; сәтті болса — қосылады (осы сәттен кейін сайтта жазылған жолдар кестеге кетеді). */
export async function saveSheetPushUrl(user: SessionUser, url: string) {
  if (!isLeader(user)) throw new Error("Тек CEO / РОП");
  const u = url.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) throw new Error("URL https://script.google.com/macros/s/…/exec түрінде болуы керек");
  const token = await get(K_TOKEN);
  if (!token) throw new Error("Алдымен скриптті көшіріңіз (токен жасалады)");
  const r = await call(u, { token, action: "ping" });
  if (!r.ok) throw new Error(r.error === "token" ? "Скриптегі токен сәйкес емес — скриптті қайта көшіріңіз" : r.error ?? "Скрипт қате қайтарды");
  if (r.sheet === false) throw new Error("Кестеде «продажи» парағы табылмады");
  await put(K_URL, u);
  if (!(await get(K_SINCE))) await put(K_SINCE, new Date().toISOString());
  return { ok: true };
}

export async function disableSheetPush(user: SessionUser) {
  if (!isLeader(user)) throw new Error("Тек CEO / РОП");
  await prisma.appSetting.deleteMany({ where: { key: { in: [K_URL, K_SINCE] } } });
}

const PENDING = "pending";

/**
 * Сайтта жазылған жолды кестеге жіберу (жаңа — бос жолға, бар — сол жолды жаңарту).
 * Бір жолды қатар екі рет жібермеу үшін «pending» белгісімен ұсталады; жіберіп жатқанда жол өзгерсе — қайта жібереді.
 */
export async function pushRowToSheet(id: string) {
  const cfg = await sheetPushConfig();
  if (!cfg.enabled) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await prisma.salesLedgerRow.findUnique({ where: { id } });
    if (!row || row.importKey || row.createdAt < cfg.since!) return; // кестеден келгендер мен ескі жолдар жіберілмейді
    if (!row.customerPhone && !row.customerName && !row.product && row.soldFor == null) return; // әлі бос
    // Ұстап алу: басқа жіберу жүріп жатса — сол аяқтағанда соңғы мәнді өзі жібереді
    const claim = await prisma.salesLedgerRow.updateMany({
      where: { id, updatedAt: row.updatedAt, OR: [{ sheetPushError: null }, { sheetPushError: { not: PENDING } }] },
      data: { sheetPushError: PENDING },
    });
    if (claim.count === 0) {
      const now = await prisma.salesLedgerRow.findUnique({ where: { id }, select: { sheetPushError: true } });
      if (now?.sheetPushError === PENDING) return;
      continue; // жол дәл қазір өзгерді — қайта оқимыз
    }
    const snapshot = await prisma.salesLedgerRow.findUniqueOrThrow({ where: { id } });
    try {
      const r = await call(cfg.url!, { token: cfg.token, row: snapshot.sheetRow ?? 0, values: toSheetValues(COLS, snapshot as never) });
      if (!r.ok || !r.row) throw new Error(r.error ?? "жауап жоқ");
      const no = Number(r.no);
      const data = { sheetRow: r.row, sheetPushedAt: new Date(), sheetPushError: null, ...(Number.isInteger(no) && no > 0 ? { no } : {}) };
      // Жіберіп жатқанда менеджер тағы бір ұяшықты өзгертпеген болса — бітті
      const done = await prisma.salesLedgerRow.updateMany({ where: { id, updatedAt: snapshot.updatedAt }, data });
      if (done.count === 1) return;
      await prisma.salesLedgerRow.update({ where: { id }, data }); // өзгерген — жол нөмірін сақтап, қайта жібереміз
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[sheet-push]", id, msg);
      await prisma.salesLedgerRow.update({ where: { id }, data: { sheetPushError: msg.slice(0, 300) } });
      return;
    }
  }
}

/** Жіберілмеген / қатемен қалған жолдарды қайта жіберу (синхрондау кезінде шақырылады). */
export async function retryPendingPushes() {
  const cfg = await sheetPushConfig();
  if (!cfg.enabled) return 0;
  // Үзіліп қалған «pending» (2 минуттан ескі) — қайта жіберуге босатамыз
  await prisma.salesLedgerRow.updateMany({ where: { sheetPushError: PENDING, updatedAt: { lt: new Date(Date.now() - 120_000) } }, data: { sheetPushError: "үзілді" } });
  const rows = await prisma.salesLedgerRow.findMany({
    where: {
      importKey: null,
      createdAt: { gte: cfg.since! },
      OR: [{ sheetPushedAt: null, updatedAt: { lt: new Date(Date.now() - 60_000) } }, { sheetPushError: { not: null } }],
    },
    select: { id: true },
    take: 20,
  });
  for (const r of rows) await pushRowToSheet(r.id);
  return rows.length;
}
