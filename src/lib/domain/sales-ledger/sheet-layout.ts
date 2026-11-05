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
export const COMPUTED_FIELDS = new Set(["no", "year", "month", "remainder", "manager"]);

/** Таблицадағы шартты түс: «окончено» — жасыл, қалғаны — сары, «возврат» — қызғылт. */
export function rowColor(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("возврат")) return "#f4cccc";
  if (s.trim() === "окончено") return "#b7e1cd";
  return "#fff2cc";
}

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
