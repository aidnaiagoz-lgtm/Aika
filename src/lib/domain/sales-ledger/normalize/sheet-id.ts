/**
 * «01.1. Продажа - Алматы» Google кестесінің идентификаторы. Құпия емес (кестенің сілтемесінде тұр).
 * Импорттар (Лидтер, Касса) Preview ортада да жұмыс істеуі үшін env болмаса — осы мән.
 * 2 минуттық тұрақты синхрондау (sheet-sync) бұрынғыдай тек SALES_SHEET_ID орнатылған ортада жүреді.
 */
export const DEFAULT_SALES_SHEET_ID = "1BSD1trnFuvZ-KRQN_ALXjEID32dFswe9OJCcVZ1xDdo";
export const salesSheetId = () => process.env.SALES_SHEET_ID || DEFAULT_SALES_SHEET_ID;
