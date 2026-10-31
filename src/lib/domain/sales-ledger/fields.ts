// Google Sheets кестесінің баған атаулары — дәлме-дәл, орыс тілінде (өзгертілмеген).
export type LedgerFieldType = "text" | "number" | "date" | "datetime-local";

export interface LedgerFieldDef {
  name: string;
  label: string;
  type: LedgerFieldType;
  readOnly?: boolean;
}

export interface LedgerFieldGroup {
  title: string;
  fields: LedgerFieldDef[];
}

export const LEDGER_FIELD_GROUPS: LedgerFieldGroup[] = [
  {
    title: "Заказ",
    fields: [
      { name: "no", label: "№ (автоматты)", type: "number", readOnly: true },
      { name: "year", label: "Год", type: "number" },
      { name: "month", label: "Мес", type: "text" },
      { name: "date", label: "Дата", type: "date" },
      { name: "manager", label: "Менеджер", type: "text" },
    ],
  },
  {
    title: "Клиент",
    fields: [
      { name: "customerPhone", label: "Номер клиента", type: "text" },
      { name: "customerName", label: "Имя клиента", type: "text" },
      { name: "contactChannel", label: "Канал обращения", type: "text" },
      { name: "certificateNo", label: "Номер сертификата", type: "text" },
      { name: "contactCity", label: "Город обращения", type: "text" },
    ],
  },
  {
    title: "Авто",
    fields: [
      { name: "car", label: "Авто", type: "text" },
      { name: "brand", label: "Марка", type: "text" },
      { name: "carYear", label: "Год (авто)", type: "number" },
    ],
  },
  {
    title: "Производство",
    fields: [
      { name: "workshop", label: "Цех", type: "text" },
      { name: "readyOrderDate", label: "Дата готового заказа", type: "date" },
      { name: "product", label: "Товар", type: "text" },
    ],
  },
  {
    title: "Комплектация",
    fields: [
      { name: "leatherType", label: "Кожа вид", type: "text" },
      { name: "leatherThread", label: "Кожа нитка", type: "text" },
      { name: "leatherPiping", label: "Кожа окантовка", type: "text" },
      { name: "matType", label: "Сьемный полик вид", type: "text" },
      { name: "matThread", label: "Сьемный полик нитка", type: "text" },
      { name: "matPiping", label: "Сьемный полик окантовка", type: "text" },
      { name: "pocketsPairs", label: "Кармашки сколько пар", type: "number" },
      { name: "pocketsLogo", label: "Кармашки лого", type: "text" },
    ],
  },
  {
    title: "Цена",
    fields: [
      { name: "price", label: "Цена", type: "number" },
      { name: "soldFor", label: "Продали за", type: "number" },
      { name: "remainder", label: "Остаток", type: "number" },
      { name: "managerBonus", label: "Бонус менеджеров", type: "number" },
    ],
  },
  {
    title: "Чек 1",
    fields: [
      { name: "receipt1Amount", label: "Чек1 сумма", type: "number" },
      { name: "receipt1Method", label: "Чек 1 способ оплаты", type: "text" },
      { name: "receipt1At", label: "Чек 1 дата/время", type: "datetime-local" },
      { name: "receipt1File", label: "Чек 1 (ссылка)", type: "text" },
    ],
  },
  {
    title: "Чек 2",
    fields: [
      { name: "receipt2Amount", label: "Чек 2 сумма", type: "number" },
      { name: "receipt2Method", label: "Чек 2 способ оплаты", type: "text" },
      { name: "receipt2At", label: "Чек 2 дата/время", type: "datetime-local" },
      { name: "receipt2File", label: "Чек 2 (ссылка)", type: "text" },
    ],
  },
  {
    title: "Чек 3",
    fields: [
      { name: "receipt3Amount", label: "Чек 3 сумма", type: "number" },
      { name: "receipt3Method", label: "Чек 3 способ оплаты", type: "text" },
      { name: "receipt3At", label: "Чек 3 дата/время", type: "datetime-local" },
      { name: "receipt3File", label: "Чек 3 (ссылка)", type: "text" },
    ],
  },
  {
    title: "Логистика и статус",
    fields: [
      { name: "pickupMethod", label: "Способ вывоза", type: "text" },
      { name: "production", label: "Производство", type: "text" },
      { name: "orderStatus", label: "Статус заказа", type: "text" },
      { name: "payments", label: "Оплаты", type: "text" },
      { name: "salesChannel", label: "Канал продаж", type: "text" },
    ],
  },
];

// Кестенің жол-тәртібі бойынша барлық баған (44) — көрсету үшін LEDGER_FIELD_GROUPS-тен жинақталады.
export const LEDGER_COLUMNS: LedgerFieldDef[] = LEDGER_FIELD_GROUPS.flatMap((g) => g.fields);
