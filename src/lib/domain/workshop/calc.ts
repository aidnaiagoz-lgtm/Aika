// Цех: таза функциялар (базасыз) — норма, операциялар, айлық есебі.

export const OPERATIONS = ["CUT", "JOIN", "EDGE", "BOTTOM"] as const;
export type Operation = (typeof OPERATIONS)[number];

export const OPERATION_LABEL: Record<Operation, string> = {
  CUT: "Резка кожи",
  JOIN: "Стыковка",
  EDGE: "Окантовка / крепление",
  BOTTOM: "Дно",
};

/** Job өрісі ↔ операция. */
export const OPERATION_FIELD: Record<Operation, "cutBy" | "joinBy" | "edgeBy" | "bottomBy"> = {
  CUT: "cutBy",
  JOIN: "joinBy",
  EDGE: "edgeBy",
  BOTTOM: "bottomBy",
};

/** «цех прайс» бетіндегі бағалар (2025-01 бастап). */
export const DEFAULT_RATES: Record<Operation, number> = { CUT: 1500, JOIN: 1500, EDGE: 1500, BOTTOM: 500 };

/**
 * Былғары нормасы (метр) — «цех реестр»-дегі 2025–2026 нақты шығынның медианасы:
 * 3Д/360 салон 2 қатар ≈ 1,75 · 5Д ≈ 2,0 · 3 қатар ≈ 2,2 · багажник ≈ 2,2.
 * Белгісіз тауар → null (Бекзат өзі жазады).
 */
export function leatherNorm(product: string | null | undefined): number | null {
  const p = (product ?? "").toLowerCase();
  if (!p.trim()) return null;
  if (p.includes("багаж")) return 2.2;
  if (/3\s*ряд/.test(p)) return 2.2;
  if (/(^|\s)5\s*д/.test(p)) return 2.0;
  if (/(^|\s)(3\s*д|360)/.test(p) && p.includes("салон")) return 1.75;
  return null;
}

export interface RateRow {
  operation: string;
  price: number;
  validFrom: Date;
}

/** Берілген күнге қолданыстағы баға (validFrom ≤ күн болатын ең соңғысы), болмаса — әдепкі. */
export function rateAt(rates: RateRow[], op: Operation, at: Date): number {
  let best: RateRow | null = null;
  for (const r of rates) {
    if (r.operation !== op || r.validFrom.getTime() > at.getTime()) continue;
    if (!best || r.validFrom.getTime() > best.validFrom.getTime()) best = r;
  }
  return best ? best.price : DEFAULT_RATES[op];
}

export interface PayJob {
  doneAt: Date | null;
  cutBy: string | null;
  joinBy: string | null;
  edgeBy: string | null;
  bottomBy: string | null;
}

export interface PayLine {
  worker: string;
  counts: Record<Operation, number>;
  sum: number;
}

/** Дайын болған тапсырмалар бойынша әр қызметкердің операция саны мен сомасы («цех отчет»). */
export function computePay(jobs: PayJob[], rates: RateRow[]): { lines: PayLine[]; total: number; jobs: number } {
  const byWorker = new Map<string, PayLine>();
  let counted = 0;
  for (const j of jobs) {
    if (!j.doneAt) continue;
    counted++;
    for (const op of OPERATIONS) {
      const name = j[OPERATION_FIELD[op]]?.trim();
      if (!name) continue;
      let line = byWorker.get(name);
      if (!line) {
        line = { worker: name, counts: { CUT: 0, JOIN: 0, EDGE: 0, BOTTOM: 0 }, sum: 0 };
        byWorker.set(name, line);
      }
      line.counts[op]++;
      line.sum += rateAt(rates, op, j.doneAt);
    }
  }
  const lines = [...byWorker.values()].sort((a, b) => b.sum - a.sum || a.worker.localeCompare(b.worker));
  return { lines, total: lines.reduce((s, l) => s + l.sum, 0), jobs: counted };
}

/** Хабарламаның қысқа мәтіні — клиенттің аты/телефоны ЖОҚ (құлыпталған экранда көрінеді). */
export function jobHeadline(j: { car?: string | null; brand?: string | null; carYear?: number | null; product?: string | null; leatherType?: string | null }): string {
  const car = [j.car, j.brand].map((s) => (s ?? "").trim()).filter(Boolean);
  // «тойота» + «тойота хайлюкс» → тек «тойота хайлюкс»
  const carText = car.length === 2 && car[1].toLowerCase().includes(car[0].toLowerCase()) ? car[1] : car.join(" ");
  const leather = (j.leatherType ?? "").replace(/^\d+\s*-\s*Кожа\s*-\s*/i, "").trim();
  return [carText + (j.carYear ? ` ${j.carYear}` : ""), j.product?.trim(), leather].filter((s) => s && s.trim()).join(" · ");
}

/** «Чья кожа»: өзіміздікі немесе былғарыны өзі әкелген опт клиент (Google «инфо» беті). */
export const LEATHER_OWNERS = [
  "Өзіміздікі", "Степ Сұңғат", "Автомода", "Асыл аға", "Ескали", "Автотренд", "Ержан", "Серикбек", "Казбек", "Тілек", "Саша",
  "Автокорона", "Карлюкс",
];

/** Іске қосқанда қосылатын қызметкерлер — «цех реестр»-де соңғы айларда жұмыс істегендер. */
export const DEFAULT_WORKERS = ["Бекзат", "Мухаммад", "Бакдаулет", "Кайрат"];
