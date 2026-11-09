/**
 * olx / olx новый парақтарының жолы → лид деректері (таза функция).
 * Парақтың сол жағы (A–Q) — формула-дашборд, импортталмайды. Журнал S бағанынан басталады,
 * тақырып жолы «№ | Дата | Менеджер | ...» (olx-та Охват, Клик, Имя бар; olx новыйда Клик пен Имя жоқ).
 */
import { normalizePhone } from "../sales-ledger/normalize/phone";
import { parseSheetDate } from "../sales-ledger/normalize/dates";
import { guessLeadReason } from "../sales-ledger/normalize/dictionaries";
import { canonicalManager } from "../sales-ledger/normalize/managers";

export type LeadSheetKey = "olx1" | "olx2";
export const LEAD_SHEETS: Record<LeadSheetKey, { account: "OLX_1" | "OLX_2"; label: string; gidEnv: string; gid: string }> = {
  olx1: { account: "OLX_1", label: "olx", gidEnv: "SALES_OLX1_GID", gid: "1153861268" },
  olx2: { account: "OLX_2", label: "olx новый", gidEnv: "SALES_OLX2_GID", gid: "1282694708" },
};

export type LeadCols = { no: number; date: number; mgr: number; reach: number; clicks: number; name: number; phone: number; city: number; car: number; comment: number };

export function findLeadHeader(rows: string[][]): { headerIndex: number; cols: LeadCols } | null {
  const hi = rows.findIndex((r) => r.some((c, i) => c.trim() === "№" && r[i + 1]?.trim() === "Дата" && r[i + 2]?.trim() === "Менеджер"));
  if (hi < 0) return null;
  const h = rows[hi].map((x) => x.trim().toLowerCase());
  const start = h.findIndex((x, i) => x === "№" && h[i + 1] === "дата");
  const col = (name: string) => h.findIndex((x, i) => i >= start && x === name);
  return {
    headerIndex: hi,
    cols: { no: start, date: col("дата"), mgr: col("менеджер"), reach: col("охват"), clicks: col("клик"), name: col("имя"), phone: col("номер"), city: col("город"), car: col("марка"), comment: col("коммент") },
  };
}

export type LeadSheetRow = {
  importKey: string;
  account: "OLX_1" | "OLX_2";
  date: Date;
  managerName: string | null;
  customerName: string | null;
  phoneRaw: string | null;
  phoneNorm: string | null;
  city: string | null;
  car: string | null;
  comment: string | null;
  reach: number | null;
  clicks: number | null;
  reasonGuess: string | null;
};

const txt = (v: string | undefined) => {
  const s = (v ?? "").trim().replace(/\s+/g, " ");
  return s ? s : null;
};
const int = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[\s ]/g, "").replace(",", "."));
  return (v ?? "").trim() && Number.isFinite(n) ? Math.round(n) : null;
};

export function mapLeadRow(sheet: LeadSheetKey, cols: LeadCols, r: string[]): LeadSheetRow | null {
  const no = (r[cols.no] ?? "").trim();
  if (!/^\d+$/.test(no)) return null;
  const d = parseSheetDate(r[cols.date]);
  if (!d.ok) return null;
  const at = (i: number) => (i >= 0 ? r[i] : undefined);
  const ph = normalizePhone(at(cols.phone));
  const comment = txt(at(cols.comment));
  return {
    importKey: `${sheet}:${no}`,
    account: LEAD_SHEETS[sheet].account,
    date: d.value,
    managerName: canonicalManager(at(cols.mgr)),
    customerName: txt(at(cols.name)),
    phoneRaw: txt(at(cols.phone)),
    phoneNorm: ph.ok ? ph.value : null,
    city: txt(at(cols.city)),
    car: txt(at(cols.car)),
    comment,
    reach: int(at(cols.reach)),
    clicks: int(at(cols.clicks)),
    reasonGuess: guessLeadReason(comment),
  };
}
