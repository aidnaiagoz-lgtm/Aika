import type { Prisma } from "@prisma/client";

/**
 * Тест аккаунт (CEO, 2026-11-21): аты-жөнінде «тест» сөзі бар менеджер (мыс. «Аягөз тест»).
 * Оның заказдары тек сайтта: Google кестеге жіберілмейді, цехқа / кассаға / рейтингке түспейді, «ТЕСТ» белгісімен көрінеді.
 */
export const TEST_NAME_RE = /(^|[\s\-_(])(тест|test)([\s\-_)]|$)/i;

export const isTestName = (name: string | null | undefined) => !!name && TEST_NAME_RE.test(name);

/** Prisma сүзгісі: тест менеджердің жолдарын алып тастау (жуық — «тест» сөзі бар) */
export const NOT_TEST_WHERE: Prisma.SalesLedgerRowWhereInput = {
  NOT: [{ manager: { contains: "тест", mode: "insensitive" } }, { manager: { contains: "test", mode: "insensitive" } }],
};
