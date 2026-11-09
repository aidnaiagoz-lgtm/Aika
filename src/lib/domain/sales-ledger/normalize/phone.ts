/**
 * Телефонды бір түрге келтіру: 8 / 7 / +7, бос орын, жақша, сызықша → 10 цифр ("7012345678").
 * Таза функция — базаға, серверге тәуелді емес (тесттер мен dry-run осыны қолданады).
 */
export type PhoneResult =
  | { ok: true; value: string; multi?: boolean }
  | { ok: false; reason: "empty" | "length" | "foreign" };

export function normalizePhone(raw: unknown): PhoneResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };
  const text = String(raw).trim().replace(/\.0+$/, ""); // Excel: 87015551234.0
  if (!text) return { ok: false, reason: "empty" };

  // Бір ұяшықта бірнеше нөмір болуы мүмкін ("8701... / 8777...") — біріншісі алынады
  const parts = text.split(/[,;/\\|]|\s{2,}|\sжәне\s|\sи\s/i).map((p) => p.trim()).filter(Boolean);
  let firstFail: PhoneResult | null = null;
  for (const part of parts) {
    const r = one(part);
    if (r.ok) return parts.length > 1 ? { ...r, multi: true } : r;
    firstFail ??= r;
  }
  return firstFail ?? { ok: false, reason: "empty" };
}

function one(part: string): PhoneResult {
  let d = part.replace(/\D/g, "");
  if (!d) return { ok: false, reason: "empty" };
  if (d.length === 11 && (d[0] === "8" || d[0] === "7")) d = d.slice(1);
  if (d.length !== 10) return { ok: false, reason: "length" };
  // Қазақстан нөмірлері 7-ден басталады (ұялы 70x/747/75x–77x, қалалық 71x–72x)
  if (d[0] !== "7") return { ok: false, reason: "foreign" };
  return { ok: true, value: d };
}

/** Көрсету үшін: "7012345678" → "8 701 234 56 78". */
export function formatPhone(ten: string): string {
  return `8 ${ten.slice(0, 3)} ${ten.slice(3, 6)} ${ten.slice(6, 8)} ${ten.slice(8, 10)}`;
}
