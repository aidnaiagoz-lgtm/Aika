// Google таблицаның «продажи» парағының көрінісі (2026-11-05, нақты таблицадан алынды).
// Бағандар реті — LEDGER_COLUMNS (A..AS).

/** Баған ені, px — таблицадағыдай. */
export const SHEET_WIDTHS = [
  50, 50, 50, 75, 100, 100, 100, 100, 100, 100, 100, 100, 75, 30, 75, 232, 150, 100, 100, 150, 116, 148, 75, 64, 75, 75, 75, 86, 75, 113,
  96, 37, 75, 115, 91, 48, 75, 100, 75, 37, 100, 100, 100, 79, 100,
];

/** Осы бағандардан кейін қалың қара сызық (топтарды бөледі). 0-ден басталатын индекс. */
export const SHEET_THICK_RIGHT = new Set([15, 18, 21, 23, 24, 27, 31, 35, 39]);

/** Таблицадағы қысқа тақырыптар (екі жолға бөлінген). */
export const SHEET_HEADERS = [
  "№", "Год", "Мес", "Дата", "Менеджер", "Номер\nклиента", "Имя\nклиента", "Канал\nобращения", "Номер\nсертификата", "Город\nобращения",
  "Авто", "Марка", "Год", "Цех", "Дата готового\nзаказа", "Товар", "Кожа\nвид", "Кожа\nнитка", "Кожа\nокантовка", "Сьемный полик\nвид",
  "Сьемный полик\nнитка", "Сьемный полик\nокантовка", "Кармашки\nсколько пар", "Кармашки\nлого", "Цена", "Продали за", "Остаток",
  "Бонус\nменеджеров", "Чек1\nсумма", "Чек 1\nспособ оплаты", "Чек 1\nдата / время", "Чек 1", "Чек 2\nсумма", "Чек 2\nспособ оплаты",
  "Чек 2\nдата / время", "Чек 2", "Чек 3\nсумма", "Чек 3\nспособ оплаты", "Чек 3\nдата / время", "Чек 3", "Способ вывоза",
  "Производство", "Статус\nзаказа", "Оплаты", "Канал продаж",
];

/** Ашылмалы тізімі бар бағандар (мәндері — бұрынғы жазбалардан). */
export const LIST_FIELDS = [
  "contactChannel", "contactCity", "car", "brand", "product", "leatherType", "leatherThread", "leatherPiping", "matType", "matThread",
  "matPiping", "receipt1Method", "receipt2Method", "receipt3Method", "pickupMethod", "production", "orderStatus", "salesChannel",
] as const;

/** Өздігінен есептелетін — қолмен өзгертілмейтін бағандар. */
export const COMPUTED_FIELDS = new Set(["no", "year", "month", "remainder"]);

// ── Түстер: Google таблицаның «продажи» парағынан дәлме-дәл (2026-11-05, xlsx/pdf экспортынан) ──
export const SHEET_PINK = "#f4c7c3"; // № бағаны және «возврат»
export const SHEET_YELLOW = "#fff2cc"; // негізгі (толтырылатын) ұяшықтар
export const SHEET_GREEN = "#b7e1cd"; // «окончено»
export const SHEET_WHITE = "#ffffff";

/** Бағанның өз түсі (шартсыз): A — қызғылт; B, C, Y (Цена), AA (Остаток), AB (Бонус), AR (Оплаты) — ақ; қалғаны — сары. */
const WHITE_COLS = new Set([1, 2, 24, 26, 27, 43]);
export function baseColor(c: number): string {
  if (c === 0) return SHEET_PINK;
  return WHITE_COLS.has(c) ? SHEET_WHITE : SHEET_YELLOW;
}

/**
 * Таблицадағы шартты форматтау (ереже реті сақталған):
 *  1) D:AQ — «Статус заказа» = «возврат» → қызғылт
 *  2) Z, AA, AB — «Остаток» ≠ «Төленді» → өз түсі (жасыл болмайды)
 *  3) D:AQ — «Статус заказа» = «окончено» → жасыл
 *  A, B, C, AR, AS — шартқа кірмейді.
 */
export function cellColor(c: number, status: string | null | undefined, remainder: string | number | null | undefined): string {
  const base = baseColor(c);
  if (c < 3 || c > 42) return base;
  const s = (status ?? "").trim().toLowerCase();
  if (s === "возврат") return SHEET_PINK;
  const paid = remainder === 0 || (typeof remainder === "string" && remainder.trim().toLowerCase() === "төленді");
  if ((c === 25 || c === 26 || c === 27) && !paid) return base;
  if (s === "окончено") return SHEET_GREEN;
  return base;
}

/** Таблицадағыдай құсбелгі (checkbox) бағандары: Цех, Кармашки лого, Чек 1/2/3. */
export const CHECKBOX_FIELDS = new Set(["workshop", "pocketsLogo", "receipt1File", "receipt2File", "receipt3File"]);
export const isChecked = (v: unknown) => v === true || (typeof v === "string" && ["true", "1", "да", "✓"].includes(v.trim().toLowerCase()));

/** Таблицадағы ұяшық туралауы (A..AS). */
export const SHEET_ALIGN: Array<"left" | "center" | "right"> = [
  "center", "center", "center", "center", "left", "center", "left", "left", "center", "center", "left", "left", "center", "center",
  "center", "left", "left", "right", "right", "left", "right", "right", "center", "center", "right", "right", "right", "right",
  "right", "left", "left", "center", "right", "left", "left", "center", "right", "left", "left", "center", "left", "left", "left",
  "center", "left",
];

export function columnLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
