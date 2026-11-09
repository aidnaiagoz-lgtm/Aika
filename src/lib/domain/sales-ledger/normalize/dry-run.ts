/**
 * Кезең 0 — DRY-RUN есебі. Google кестені (продажи, olx, olx новый, касса) оқиды, нормалайды да
 * тек САНДАРДЫ шығарады. Базаға ештеңе жазбайды. Телефон мен клиент аты шығарылмайды.
 *
 *   pnpm sales:dry-run            → есеп stdout-қа (Markdown)
 */
import { parseCsv } from "./csv";
import { salesSheetId } from "./sheet-id";
import { normalizePhone } from "./phone";
import { parseSheetDate, dateShape } from "./dates";
import { matchChannel, guessLeadReason, OLX_UNKNOWN, LEAD_REASONS, CHANNELS, PAY_METHODS } from "./dictionaries";
import { parsePayment } from "./payment";
import { canonicalManager, MANAGER_ALIASES } from "./managers";

const SHEET_ID = salesSheetId();
const GID = { sales: "0", olx1: "1153861268", olx2: "1282694708", kassa: "59939132" };

async function sheet(gid: string): Promise<string[][]> {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Google Sheets ${res.status} (gid=${gid})`);
  return parseCsv(await res.text());
}

class Tally extends Map<string, number> {
  add(k: string, n = 1) {
    this.set(k, (this.get(k) ?? 0) + n);
  }
  top(n = 15) {
    return [...this.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
}
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const out: string[] = [];
const p = (s = "") => out.push(s);
const table = (head: string[], rows: (string | number)[][]) => {
  p(`| ${head.join(" | ")} |`);
  p(`|${head.map(() => "---").join("|")}|`);
  for (const r of rows) p(`| ${r.join(" | ")} |`);
  p();
};

/** Лид парағы: тақырып жолын «№ / Дата / Менеджер» бойынша S бағанынан іздейміз. */
function leadSheet(rows: string[][]) {
  const hi = rows.findIndex((r) => r[18]?.trim() === "№" && r[19]?.trim() === "Дата");
  if (hi < 0) throw new Error("Лид парағында тақырып жолы табылмады");
  const h = rows[hi].map((x) => x.trim().toLowerCase());
  const col = (name: string) => h.findIndex((x, i) => i >= 18 && x === name);
  const c = { no: col("№"), date: col("дата"), mgr: col("менеджер"), phone: col("номер"), channel: col("канал"), city: col("город"), car: col("марка"), comment: col("коммент") };
  const data = rows.slice(hi + 1).filter((r) => /^\d+$/.test((r[c.no] ?? "").trim()));
  return { headerRow: hi + 1, c, data };
}

async function main() {
  const [sales, olx1, olx2, kassa] = await Promise.all([sheet(GID.sales), sheet(GID.olx1), sheet(GID.olx2), sheet(GID.kassa)]);
  p(`# Кезең 0 — DRY-RUN есебі`);
  p(`Уақыты: ${new Date().toISOString()} · базаға ештеңе жазылған жоқ · телефон/клиент аттары шығарылмайды`);
  p();

  // ───────── продажи ─────────
  const rows = sales.slice(1).filter((r) => /^\d+$/.test((r[0] ?? "").trim()) && (r[3] ?? "").trim());
  const phone = new Tally(), chan = new Tally(), chanBad = new Tally(), pay = new Tally(), payBad = new Tally(), acct = new Tally();
  const dateBad = new Tally(), dateReason = new Tally(), mgr = new Tally();
  let receipts = 0, receiptDateOk = 0, saleDateOk = 0;
  const orders = new Set<string>();
  const olxSalePhones: string[] = [];
  for (const r of rows) {
    const ph = normalizePhone(r[5]);
    phone.add(ph.ok ? (ph.multi ? "дұрыс (бірнеше нөмір — біріншісі алынды)" : "дұрыс") : ph.reason === "empty" ? "бос" : ph.reason === "length" ? "қате: цифр саны" : "қате: шетелдік / 7-ден басталмайды");
    const d = parseSheetDate(r[3]);
    if (d.ok) saleDateOk++;
    orders.add(`${ph.ok ? ph.value : (r[6] ?? "").trim().toLowerCase() || r[0]}|${(r[3] ?? "").trim()}`);

    const ch = matchChannel(r[7]);
    if (!ch) chan.add("(бос)");
    else if (ch.code === null) chanBad.add(ch.raw), chan.add("сәйкес келмеді");
    else chan.add(ch.code === OLX_UNKNOWN ? "ОЛХ (аккаунты белгісіз)" : CHANNELS.find((x) => x.code === ch.code)!.label);
    if (ch?.code === OLX_UNKNOWN && ph.ok) olxSalePhones.push(ph.value);

    const m = canonicalManager(r[4]);
    mgr.add(m ?? "(бос)");

    for (const [amt, meth, at] of [[28, 29, 30], [32, 33, 34], [36, 37, 38]]) {
      if (!(r[amt] ?? "").trim() && !(r[meth] ?? "").trim() && !(r[at] ?? "").trim()) continue;
      receipts++;
      const pm = parsePayment(r[meth]);
      if (!pm) pay.add("(тәсілі жазылмаған)");
      else if (pm.method === null) payBad.add(pm.raw), pay.add("сәйкес келмеді");
      else {
        pay.add(pm.method);
        if (pm.account) acct.add(pm.account);
      }
      const rd = parseSheetDate(r[at]);
      if (rd.ok) receiptDateOk++;
      else if (rd.reason !== "empty") dateBad.add(dateShape(r[at])), dateReason.add(rd.reason);
      else dateReason.add("бос");
    }
  }

  p(`## 1. продажи`);
  table(["Көрсеткіш", "Саны"], [
    ["Жол (№ және Дата бар)", rows.length],
    ["Тапсырыс шамамен (телефон/аты + күн бойынша топталған)", orders.size],
    ["Сатылым күні оқылды", `${saleDateOk} (${pct(saleDateOk, rows.length)})`],
  ]);
  p(`### Телефон`);
  table(["Күйі", "Жол", "%"], phone.top().map(([k, v]) => [k, v, pct(v, rows.length)]));
  p(`### Канал → анықтамалық`);
  table(["Канал", "Жол", "%"], chan.top(20).map(([k, v]) => [k, v, pct(v, rows.length)]));
  if (chanBad.size) {
    p(`Сәйкес келмеген каналдар (сізден шешім керек):`);
    table(["Кестедегі мәтін", "Жол"], chanBad.top(20));
  }
  p(`### Менеджер (бір адамның нұсқалары біріктірілгеннен кейін)`);
  p(`Біріктірілген нұсқалар: ${Object.entries(MANAGER_ALIASES).map(([a, b]) => `«${a}» → «${b}»`).join(", ")}`);
  p();
  table(["Менеджер", "Жол"], mgr.top(40));
  p(`### Төлемдер (Чек 1–3)`);
  table(["Көрсеткіш", "Саны"], [["Чек жазбалары", receipts], ["Чек күні/уақыты оқылды", `${receiptDateOk} (${pct(receiptDateOk, receipts)})`]]);
  table(["Төлем тәсілі", "Чек", "%"], pay.top().map(([k, v]) => [PAY_METHODS.find((m) => m.code === k)?.label ?? k, v, pct(v, receipts)]));
  if (payBad.size) table(["Сәйкес келмеген тәсіл мәтіні", "Чек"], payBad.top(20));
  p(`Шот (тәсілден бөлек жазылғаны):`);
  table(["Шот", "Чек"], acct.top(20));
  p(`Чек күні оқылмағандар — себебі: ${dateReason.top().map(([k, v]) => `${k} ${v}`).join(", ")}`);
  p();
  if (dateBad.size) table(["Оқылмаған күн пішіні (цифр → 9)", "Саны"], dateBad.top(20));

  // ───────── olx / olx новый ─────────
  const leadReport = (name: string, rowsRaw: string[][]) => {
    const { headerRow, c, data } = leadSheet(rowsRaw);
    const ph = new Tally(), reason = new Tally(), m = new Tally();
    const phones = new Set<string>();
    let dateOk = 0;
    for (const r of data) {
      const x = normalizePhone(r[c.phone]);
      ph.add(x.ok ? "дұрыс" : x.reason === "empty" ? "бос" : "қате");
      if (x.ok) phones.add(x.value);
      if (parseSheetDate(r[c.date]).ok) dateOk++;
      const g = guessLeadReason(r[c.comment]);
      reason.add(g ? LEAD_REASONS.find((l) => l.code === g)!.label : (r[c.comment] ?? "").trim() ? "Басқа (түсіндірме бар, себеп анықталмады)" : "(түсіндірме жоқ)");
      m.add(canonicalManager(r[c.mgr]) ?? "(бос)");
    }
    p(`## ${name}`);
    table(["Көрсеткіш", "Саны"], [
      ["Тақырып жолы", headerRow],
      ["Лид", data.length],
      ["Күні оқылды", `${dateOk} (${pct(dateOk, data.length)})`],
      ...ph.top().map(([k, v]) => [`Телефон: ${k}`, `${v} (${pct(v, data.length)})`]),
    ]);
    table(["Себеп (түсіндірмеден)", "Лид", "%"], reason.top().map(([k, v]) => [k, v, pct(v, data.length)]));
    table(["Менеджер", "Лид"], m.top(20));
    return phones;
  };
  const p1 = leadReport("2. olx (→ ОЛХ-1)", olx1);
  const p2 = leadReport("3. olx новый (→ ОЛХ-2)", olx2);

  // ОЛХ сатылымдарының аккаунтын телефон бойынша анықтау
  const acc = new Tally();
  for (const ph of olxSalePhones) acc.add(p1.has(ph) && p2.has(ph) ? "екеуінде де бар" : p1.has(ph) ? "тек olx → ОЛХ-1" : p2.has(ph) ? "тек olx новый → ОЛХ-2" : "лид парақтарында жоқ");
  p(`## 4. «олх» сатылымдары — аккаунтты телефон бойынша анықтау`);
  table(["Нәтиже", "Сатылым (телефоны дұрыс)", "%"], acc.top().map(([k, v]) => [k, v, pct(v, olxSalePhones.length)]));

  // ───────── касса ─────────
  const kh = kassa.findIndex((r) => (r[0] ?? "").trim().startsWith("Номер"));
  const kRows = kassa.slice(kh + 1).filter((r) => /^\d+$/.test((r[0] ?? "").trim()));
  const saleNos = new Set(rows.map((r) => r[0].trim()));
  const kMatched = kRows.filter((r) => saleNos.has(r[0].trim())).length;
  const flag = (i: number) => kRows.filter((r) => (r[i] ?? "").trim().toUpperCase() === "TRUE").length;
  const filled = (i: number) => kRows.filter((r) => (r[i] ?? "").trim()).length;
  p(`## 5. касса`);
  table(["Көрсеткіш", "Саны"], [
    ["Тақырып жолы", kh + 1],
    ["Жол", kRows.length],
    ["№ продажимен сәйкес келді", `${kMatched} (${pct(kMatched, kRows.length)})`],
    ["«ст МОП берілді» толтырылған", filled(12)],
    ["«ст МОП қабылданды» = TRUE", flag(13)],
    ["«Еділ аға» = TRUE", flag(14)],
  ]);
  p(`Ескерту: C бағанының тақырыбы бос (ішінде менеджер), «Год выпуска» бағанында — марка, «Товар» бағанында — жыл (тақырыптар бір бағанға жылжыған).`);

  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
