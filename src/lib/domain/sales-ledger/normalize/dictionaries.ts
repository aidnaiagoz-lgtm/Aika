/**
 * Сату бөлімінің тұрақты анықтамалықтары. Әр мәнде: код (базада сақталады), атауы (UI-да)
 * және кестедегі ескі жазылу нұсқалары (aliases, кіші әріппен).
 * Кезең 0: тек код ішіндегі тізімдер — schema-ға тимейді. Кейін CEO өзгерткісі келсе, кестеге көшіріледі.
 */
export type DictItem<C extends string = string> = { code: C; label: string; aliases: string[] };

export const CHANNELS = [
  // «Сипуни» — қоңырау қызметі; қолданушы шешімі (2026-11-09): ватсапқа жатады
  { code: "WHATSAPP", label: "ватсап", aliases: ["ватсап", "whatsapp", "вотсап", "ватсапп", "wa", "сипуни", "sipuni"] },
  { code: "WALK_IN", label: "өзі келді", aliases: ["өзі келді", "озы келди", "өзі келді ", "сам пришел", "өзі"] },
  { code: "OLX_1", label: "ОЛХ-1", aliases: ["олх-1", "олх 1", "olx-1", "olx 1", "олх1", "olx1"] },
  { code: "OLX_2", label: "ОЛХ-2", aliases: ["олх-2", "олх 2", "olx-2", "olx 2", "олх2", "olx2", "olx новый", "олх новый"] },
  { code: "RETURNING", label: "ескі клиент", aliases: ["ескі клиент", "старый клиент", "ески клиент"] },
  { code: "INSTAGRAM", label: "инстаграм", aliases: ["инстаграм", "instagram", "инста"] },
  { code: "TIKTOK", label: "ТикТок", aliases: ["тикток", "tiktok", "тик ток"] },
  { code: "SITE", label: "сайт", aliases: ["сайт", "site"] },
  { code: "KASPI", label: "каспий", aliases: ["каспий", "kaspi"] },
  { code: "CERTIFICATE", label: "сертификат", aliases: ["сертификат"] },
  { code: "REFERRAL", label: "сарафан", aliases: ["сарафан", "сарафанное", "сарафанка", "едыл ага танысы", "еділ аға танысы"] },
] as const satisfies readonly DictItem[];
export type ChannelCode = (typeof CHANNELS)[number]["code"];

/** «олх» — ОЛХ, бірақ қай аккаунт екені белгісіз (ескі жазбалар). Аккаунт телефон бойынша анықталады. */
export const OLX_UNKNOWN = "OLX_UNKNOWN" as const;
const OLX_PLAIN = ["олх", "olx", "олх ", "оlх"];

export type ChannelMatch = { code: ChannelCode | typeof OLX_UNKNOWN } | { code: null; raw: string };

/** Канал коды → атауы (OLX_UNKNOWN — «ОЛХ»). */
export function channelLabel(code: string | null | undefined): string {
  if (!code) return "";
  if (code === OLX_UNKNOWN) return "ОЛХ";
  return CHANNELS.find((c) => c.code === code)?.label ?? code;
}

export const isOlxChannel = (code: string | null | undefined) => code === "OLX_1" || code === "OLX_2" || code === OLX_UNKNOWN;

export function matchChannel(raw: unknown): ChannelMatch | null {
  const s = norm(raw);
  if (!s) return null;
  if (OLX_PLAIN.includes(s)) return { code: OLX_UNKNOWN };
  const hit = CHANNELS.find((c) => (c.aliases as readonly string[]).includes(s) || c.label.toLowerCase() === s);
  return hit ? { code: hit.code } : { code: null, raw: String(raw).trim() };
}

export const PAY_METHODS = [
  { code: "KASPI_PAY", label: "Kaspi Pay", aliases: ["каспий пэй", "каспи пэй", "kaspi pay", "каспий пей", "каспий qr"] },
  { code: "KASPI_GOLD", label: "Kaspi Gold", aliases: ["каспий голд", "kaspi gold", "каспи голд"] },
  { code: "HALYK", label: "Halyk", aliases: ["халык банк", "халық банк", "halyk", "халык"] },
  { code: "HOME", label: "Home", aliases: ["хоум банк", "home bank", "хоум кредит", "хоум"] },
  { code: "CASH", label: "Қолма-қол", aliases: ["наличными", "наличные", "нал", "қолма-қол"] },
  { code: "KASPI_SHOP", label: "Kaspi магазин", aliases: ["каспий магазин", "kaspi магазин", "каспи магазин"] },
  { code: "SALARY_DEDUCTION", label: "ЗП-дан ұстау", aliases: ["удержали с зп", "с зп", "зп-дан ұстау"] },
] as const satisfies readonly DictItem[];
export type PayMethodCode = (typeof PAY_METHODS)[number]["code"];

export const LEAD_REASONS = [
  { code: "ONLY_EVA", label: "Тек ЕВА керек", aliases: ["ева", "eva"] },
  { code: "EXPENSIVE", label: "Қымбат", aliases: ["дорого", "қымбат", "кымбат", "дорог"] },
  { code: "THINKING", label: "Ойланып жүр", aliases: ["ойлан", "подумаю", "думает", "ойланам"] },
  { code: "OTHER_CITY", label: "Басқа қалада", aliases: ["басқа қала", "баска кала", "другой город", "тек семей", "в другом городе"] },
  { code: "NO_ANSWER", label: "Жауап бермеді", aliases: ["жауап берм", "не отвеч", "трубку", "алмады", "недоступ"] },
  { code: "WILL_COME", label: "Келемін деді", aliases: ["келем", "приеду", "приду", "барам", "келеді"] },
  { code: "OTHER", label: "Басқа", aliases: [] },
] as const satisfies readonly DictItem[];
export type LeadReasonCode = (typeof LEAD_REASONS)[number]["code"];

/** Лид түсіндірмесінен (коммент) себепті табу — бірінші сәйкес келгені. Табылмаса — null. */
export function guessLeadReason(comment: unknown): LeadReasonCode | null {
  const s = norm(comment);
  if (!s) return null;
  for (const r of LEAD_REASONS) if ((r.aliases as readonly string[]).some((a) => s.includes(a))) return r.code;
  return null;
}

export function norm(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/ё/g, "е");
}
