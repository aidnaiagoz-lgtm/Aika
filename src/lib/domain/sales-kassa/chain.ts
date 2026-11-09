/**
 * Касса — таза логика (базаға тәуелсіз, тесттер осыны тексереді).
 *
 * Ереже 4: Продажиде «Чек N способ оплаты» = қолма-қол болса, ол Кассада өзі көрінеді.
 * Тапсыру тізбегі — оқиғалар: HANDED (менеджер тапсырды, кімге) → SENIOR_RECEIVED (ст МОП) → OWNER_RECEIVED (Еділ аға).
 * Менеджер ақшаны бірден Еділ ағаға берсе: HANDED(toName = OWNER) → OWNER_RECEIVED.
 */
import { parsePayment } from "../sales-ledger/normalize/payment";

export const OWNER_NAME = "Еділ аға";
export type Step = "HANDED" | "SENIOR_RECEIVED" | "OWNER_RECEIVED";
export type Stage = "MANAGER" | "HANDED_SENIOR" | "HANDED_OWNER" | "SENIOR" | "OWNER" | "ARCHIVE";
export const STAGE_LABEL: Record<Stage, string> = {
  MANAGER: "менеджердің қолында",
  HANDED_SENIOR: "ст МОП қабылдауын күтуде",
  HANDED_OWNER: "Еділ аға қабылдауын күтуде",
  SENIOR: "ст МОП-та",
  OWNER: "Еділ аға қабылдады",
  ARCHIVE: "архив (ескі, тізбегі белгісіз)",
};

export type LedgerLike = {
  soldFor: number | null;
  receipts: { no: 1 | 2 | 3; amount: number | null; method: string | null; at: Date | null }[];
  date: Date | null;
};
export type CashReceipt = { receiptNo: 1 | 2 | 3; amount: number; at: Date | null; kind: "100%" | "предоплата" | "доплата" };

/** Жолдағы қолма-қол чектер. */
export function cashReceipts(row: LedgerLike): CashReceipt[] {
  const out: CashReceipt[] = [];
  for (const r of row.receipts) {
    const pm = parsePayment(r.method);
    if (!pm || pm.method !== "CASH" || !r.amount || r.amount <= 0) continue;
    const kind = r.no === 1 ? (row.soldFor != null && r.amount >= row.soldFor ? "100%" : "предоплата") : "доплата";
    out.push({ receiptNo: r.no, amount: r.amount, at: r.at ?? row.date, kind });
  }
  return out;
}

export type EventLike = { step: Step; toName: string | null; at: Date; userName?: string | null };

/**
 * Оқиғалар бойынша чектің қазіргі күйі.
 * `openFrom` — есеп басталатын күн: одан бұрынғы, Еділ аға қабылдамаған чектер — архив (қалдыққа кірмейді).
 * Себебі ескі «касса» парағында «Еділ аға» белгісі көп жағдайда қойылмаған (1844 жолдың 385-і).
 */
export function stageOf(events: EventLike[], receiptAt: Date | null, openFrom: Date | null): Stage {
  const has = (s: Step) => events.some((e) => e.step === s);
  if (has("OWNER_RECEIVED")) return "OWNER";
  if (openFrom && receiptAt && receiptAt.getTime() < openFrom.getTime()) return "ARCHIVE";
  if (has("SENIOR_RECEIVED")) return "SENIOR";
  const handed = events.find((e) => e.step === "HANDED");
  if (handed) return handed.toName === OWNER_NAME ? "HANDED_OWNER" : "HANDED_SENIOR";
  return "MANAGER";
}

/** Ақша қазір кімнің қолында (қалдық есебі үшін). */
export function holderOf(stage: Stage, manager: string | null, handedTo: string | null, senior: string | null): string | null {
  switch (stage) {
    case "MANAGER":
      return manager ?? "(менеджер белгісіз)";
    case "HANDED_SENIOR":
    case "HANDED_OWNER":
      return manager ?? "(менеджер белгісіз)"; // қабылдағанша — тапсырушының жауапкершілігінде
    case "SENIOR":
      return senior ?? handedTo ?? "ст МОП";
    default:
      return null; // OWNER, ARCHIVE — қолда емес
  }
}

export type Role = { isManagerOfRow: boolean; isSenior: boolean; isOwner: boolean; isLeader: boolean };
/** Келесі әрекет кімге рұқсат. */
export function nextStep(stage: Stage, role: Role): Step | null {
  if (stage === "MANAGER" && (role.isManagerOfRow || role.isLeader)) return "HANDED";
  if (stage === "HANDED_SENIOR" && (role.isSenior || role.isLeader)) return "SENIOR_RECEIVED";
  if ((stage === "SENIOR" || stage === "HANDED_OWNER") && role.isOwner) return "OWNER_RECEIVED";
  return null;
}

/** Ескі «касса» парағындағы белгілер → бастапқы оқиғалар. */
export function eventsFromSheet(r: { givenTo: string; seniorOk: boolean; ownerOk: boolean; at: Date }): { step: Step; toName: string | null; at: Date }[] {
  const out: { step: Step; toName: string | null; at: Date }[] = [];
  const to = r.givenTo.trim();
  const toOwner = /еділ|едил/i.test(to);
  if (to || r.seniorOk || r.ownerOk) out.push({ step: "HANDED", toName: toOwner ? OWNER_NAME : to || null, at: r.at });
  if (r.seniorOk && !toOwner) out.push({ step: "SENIOR_RECEIVED", toName: null, at: r.at });
  if (r.ownerOk) out.push({ step: "OWNER_RECEIVED", toName: null, at: r.at });
  return out;
}

/** Ескі парақтағы соманы жолдың қолма-қол чегімен сәйкестендіру. */
export function matchReceiptNo(receipts: CashReceipt[], amount: number | null): 1 | 2 | 3 {
  if (amount != null) {
    const hit = receipts.find((r) => r.amount === amount);
    if (hit) return hit.receiptNo;
  }
  return receipts[0]?.receiptNo ?? 1;
}
