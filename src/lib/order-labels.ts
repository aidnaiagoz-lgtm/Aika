import type { StatusTone } from "@/lib/ui";
import type { Locale } from "@/lib/i18n";

type LabelMap = Record<string, string>;

function byLocale(locale: Locale, kk: LabelMap, ru: LabelMap): LabelMap {
  return locale === "ru" ? ru : kk;
}

export function orderStatusLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    {
      DRAFT: "Жоба",
      NEW: "Жаңа",
      CONFIRMED: "Расталды",
      WAITING_PAYMENT: "Төлем күтілуде",
      WAITING_PRODUCTION: "Өндіріс күтілуде",
      IN_PRODUCTION: "Өндірісте",
      READY: "Дайын",
      WAITING_INSTALLATION: "Орнату күтілуде",
      WAITING_DELIVERY: "Доставка күтілуде",
      IN_DELIVERY: "Жолда",
      COMPLETED: "Аяқталды",
      CANCELLED: "Болдырылмады",
      RETURNED: "Қайтарылды",
      REWORK: "Қайта жасау",
    },
    {
      DRAFT: "Черновик",
      NEW: "Новый",
      CONFIRMED: "Подтверждён",
      WAITING_PAYMENT: "Ожидает оплаты",
      WAITING_PRODUCTION: "Ожидает производства",
      IN_PRODUCTION: "В производстве",
      READY: "Готов",
      WAITING_INSTALLATION: "Ожидает установки",
      WAITING_DELIVERY: "Ожидает доставки",
      IN_DELIVERY: "В пути",
      COMPLETED: "Завершён",
      CANCELLED: "Отменён",
      RETURNED: "Возвращён",
      REWORK: "Переделка",
    }
  );
}

export const ORDER_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  NEW: "new",
  CONFIRMED: "new",
  WAITING_PAYMENT: "shipping",
  WAITING_PRODUCTION: "shipping",
  IN_PRODUCTION: "processing",
  READY: "success",
  WAITING_INSTALLATION: "shipping",
  WAITING_DELIVERY: "shipping",
  IN_DELIVERY: "processing",
  COMPLETED: "success",
  CANCELLED: "danger",
  RETURNED: "danger",
  REWORK: "danger",
};

export function paymentStatusLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    {
      NOT_PAID: "Төленбеген",
      PARTIALLY_PAID: "Ішінара төленген",
      PAID: "Төленген",
      OVERPAID: "Артық төленген",
      REFUNDED: "Қайтарылған",
    },
    {
      NOT_PAID: "Не оплачен",
      PARTIALLY_PAID: "Частично оплачен",
      PAID: "Оплачен",
      OVERPAID: "Переплата",
      REFUNDED: "Возвращён",
    }
  );
}

export const PAYMENT_STATUS_TONE: Record<string, StatusTone> = {
  NOT_PAID: "danger",
  PARTIALLY_PAID: "shipping",
  PAID: "success",
  OVERPAID: "processing",
  REFUNDED: "neutral",
};

export function priorityLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    { LOW: "Төмен", NORMAL: "Қалыпты", HIGH: "Жоғары", URGENT: "Шұғыл" },
    { LOW: "Низкий", NORMAL: "Обычный", HIGH: "Высокий", URGENT: "Срочный" }
  );
}

export function fulfillmentLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    { INSTALLATION: "Орнату", DELIVERY: "Доставка", PICKUP: "Өзі алып кету" },
    { INSTALLATION: "Установка", DELIVERY: "Доставка", PICKUP: "Самовывоз" }
  );
}

export function paymentMethodLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    {
      CASH: "Қолма-қол",
      KASPI_QR: "Kaspi QR",
      KASPI_PAY: "Kaspi Pay",
      KASPI_RED: "Kaspi Red",
      KASPI_CREDIT: "Kaspi Credit",
      BANK_TRANSFER: "Банк аударымы",
      HALYK: "Halyk",
      OTHER: "Басқа",
    },
    {
      CASH: "Наличные",
      KASPI_QR: "Kaspi QR",
      KASPI_PAY: "Kaspi Pay",
      KASPI_RED: "Kaspi Red",
      KASPI_CREDIT: "Kaspi Credit",
      BANK_TRANSFER: "Банковский перевод",
      HALYK: "Halyk",
      OTHER: "Другое",
    }
  );
}

export function productionStageLabel(locale: Locale): LabelMap {
  return byLocale(
    locale,
    {
      NEW: "Жаңа",
      QUEUED: "Кезекте",
      CUTTING: "Кесу",
      ASSEMBLY: "Жинау",
      EDGING: "Кант тігу",
      LOGO: "Лого",
      QUALITY_CHECK: "QC тексеру",
      READY: "Дайын",
      REWORK: "Қайта жасау",
      DEFECT: "Брак",
      CANCELLED: "Болдырылмады",
    },
    {
      NEW: "Новый",
      QUEUED: "В очереди",
      CUTTING: "Резка",
      ASSEMBLY: "Сборка",
      EDGING: "Окантовка",
      LOGO: "Лого",
      QUALITY_CHECK: "Проверка QC",
      READY: "Готов",
      REWORK: "Переделка",
      DEFECT: "Брак",
      CANCELLED: "Отменён",
    }
  );
}

export const PRODUCTION_STAGE_TONE: Record<string, StatusTone> = {
  NEW: "neutral",
  QUEUED: "neutral",
  CUTTING: "processing",
  ASSEMBLY: "processing",
  EDGING: "processing",
  LOGO: "processing",
  QUALITY_CHECK: "shipping",
  READY: "success",
  REWORK: "danger",
  DEFECT: "danger",
  CANCELLED: "danger",
};

/** advanceProductionStage-тен READY алынып тасталған (тек QC арқылы) — сондықтан
 *  дропдаунда келесі мүмкін стадиялар осы тізімнен ғана таңдалады. */
export const PRODUCTION_STAGE_OPTIONS = ["NEW", "QUEUED", "CUTTING", "ASSEMBLY", "EDGING", "LOGO", "QUALITY_CHECK"];

export const SOURCE_OPTIONS = [
  "Instagram Ads",
  "Instagram Organic",
  "TikTok",
  "Facebook",
  "OLX",
  "Kaspi",
  "Website",
  "WhatsApp",
  "Offline Store",
  "Auto Bazaar",
  "Recommendation",
  "Repeat Client",
  "Other",
];

export function formatTenge(value: number | string | { toString(): string }): string {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₸`;
}
