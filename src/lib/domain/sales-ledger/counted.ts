import type { Prisma } from "@prisma/client";

/**
 * Рейтинг пен айналымда саналатын жолдар (CEO, 2026-11-21): «қазірше тек Google таблицадағы заказдарды сана».
 * Google-дан келген жол (importKey "excel:…") немесе сайттан Google-ға сәтті түскен жол (sheetPushedAt бар).
 * Сайтта енгізіліп, кестеге түспегені (тест / скрипт қатесі) саналмайды — сайт пен Google әрқашан бірдей.
 */
export const IN_SHEET_WHERE: Prisma.SalesLedgerRowWhereInput = {
  OR: [{ importKey: { startsWith: "excel:" } }, { sheetPushedAt: { not: null } }],
};
