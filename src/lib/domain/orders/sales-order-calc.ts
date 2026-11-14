// Сатылым заказы (Google кестенің орнына): таза функциялар — төлемдерді Продажи жолдарына бөлу т.б.

export interface PaymentIn {
  amount: number;
  method: string; // кестедегі мәтін: «каспий пэй», «каспий пэй зере», «наличными»...
  date: string; // YYYY-MM-DD
}

/**
 * Заказдағы төлемдерді тауар жолдарына (Продажи) «сарқырама» тәсілімен бөледі:
 * бірінші жолдың сатылған сомасы толғанша — соған, сосын келесісіне. Кестеде бір жолға ең көбі 3 чек,
 * сондықтан артығы 3-ші чекке қосылады. Барлық жолдардан асқан сома соңғы жолға жазылады.
 */
export function allocateReceipts(soldFor: number[], payments: PaymentIn[]): PaymentIn[][] {
  const rows: PaymentIn[][] = soldFor.map(() => []);
  if (rows.length === 0) return rows;
  const need = soldFor.map((v) => Math.max(0, v || 0));
  let r = 0;
  const push = (row: number, p: PaymentIn) => {
    const list = rows[row];
    if (list.length < 3) list.push({ ...p });
    else list[2] = { ...list[2], amount: list[2].amount + p.amount };
  };
  for (const pay of payments) {
    let left = Math.max(0, pay.amount || 0);
    if (left === 0) continue;
    while (left > 0) {
      while (r < rows.length - 1 && need[r] <= 0) r++;
      const take = r === rows.length - 1 ? left : Math.min(left, need[r]);
      push(r, { ...pay, amount: take });
      need[r] -= take;
      left -= take;
    }
  }
  return rows;
}

/** Google кестедегі «Чек N способ оплаты» коды → Order.Payment enum. */
export function paymentEnum(code: string | null): "CASH" | "KASPI_PAY" | "KASPI_QR" | "HALYK" | "BANK_TRANSFER" | "OTHER" {
  switch (code) {
    case "CASH":
      return "CASH";
    case "KASPI_PAY":
      return "KASPI_PAY";
    case "KASPI_GOLD":
      return "BANK_TRANSFER";
    case "HALYK":
      return "HALYK";
    default:
      return "OTHER";
  }
}

/** Тауар бағасы мен сатылған сомасынан жеңілдік. */
export function itemMoney(price: number | null, soldFor: number | null) {
  const sold = Math.max(0, soldFor ?? price ?? 0);
  const base = Math.max(sold, price ?? sold);
  return { base, sold, discount: base - sold };
}

/**
 * Сома өрісі: «90 000» → 90000. Бос / null → null (МАҢЫЗДЫ: бос «Продали за» 0 емес, null — сонда баға алынады;
 * 2026-11-14 дейін бос өріс 0 болып, сатылым 0 ₸ болып сақталатын).
 */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
