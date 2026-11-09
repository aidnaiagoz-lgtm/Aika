import { PAY_METHODS, norm, type PayMethodCode } from "./dictionaries";

/**
 * Кестедегі «Чек N способ оплаты» мәтінінде төлем тәсілі мен шот араласқан:
 *   "каспий пэй зере" → тәсілі Kaspi Pay, шоты «Зере»; "Халык банк Зере" → Halyk + «Зере".
 * Шоттың кімдікі екені белгісіз — тек атауы бөлек сақталады.
 */
export type PaymentParse = { method: PayMethodCode; account: string | null } | { method: null; raw: string };

export function parsePayment(raw: unknown): PaymentParse | null {
  const s = norm(raw);
  if (!s) return null;
  // Ұзын нұсқадан бастаймыз ("каспий пэй" "каспий"-ден бұрын тексерілсін)
  const candidates = PAY_METHODS.flatMap((m) => m.aliases.map((a) => ({ code: m.code, alias: a as string }))).sort(
    (a, b) => b.alias.length - a.alias.length
  );
  for (const c of candidates) {
    if (s === c.alias || s.startsWith(c.alias + " ")) {
      const rest = s.slice(c.alias.length).trim();
      return { method: c.code, account: rest ? capitalize(rest) : null };
    }
  }
  return { method: null, raw: String(raw).trim() };
}

function capitalize(s: string) {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
