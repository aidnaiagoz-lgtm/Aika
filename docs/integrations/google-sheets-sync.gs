/**
 * AutoMax — Google Sheets «продажи» → сайт (automax-erp.vercel.app) синхрондауы.
 *
 * Орнату (бір рет, CEO):
 *   1. Google таблицада: Расширения → Apps Script. Осы файлдың бүкіл мәтінін қойыңыз, сақтаңыз.
 *   2. Сол жақта ⚙ «Настройки проекта» → «Свойства скрипта» → «Добавить свойство»:
 *        SYNC_TOKEN = (Claude берген токен)
 *   3. Жоғарыдағы тізімнен `setup` функциясын таңдап → «Выполнить» → Google рұқсатын беріңіз.
 *      Бұл бірден бір синхрондау жасайды және әр 10 минут сайынғы автоматты іске қосуды орнатады.
 *
 * Не жібереді: «продажи» парағындағы соңғы DAYS күннің жолдары (A..AS, 45 баған).
 * Таблицадан жол өшірілсе — сайттан да өшеді (тек осы терезеде).
 * Токен кодта жоқ — тек Script Properties-те сақталады.
 */

const SYNC_URL = "https://automax-erp.vercel.app/api/sync/sales";
const SHEET_NAME = "продажи";
const DAYS = 40; // соңғы 40 күн (кейінірек түзетілген жолдар да жаңарсын)
const CHUNK = 400;
const TZ = "Asia/Almaty";
const COLS = 45;

function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncSales")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncSales").timeBased().everyMinutes(10).create();
  syncSales();
}

function cell_(v) {
  if (v instanceof Date) {
    const hm = Utilities.formatDate(v, TZ, "HH:mm");
    return hm === "00:00" ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm");
  }
  if (v === "" || v === undefined) return null;
  return v;
}

function post_(token, payload) {
  const res = UrlFetchApp.fetch(SYNC_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error("Сайт қатесі " + code + ": " + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

function syncSales() {
  const token = PropertiesService.getScriptProperties().getProperty("SYNC_TOKEN");
  if (!token) throw new Error("SYNC_TOKEN орнатылмаған (Настройки проекта → Свойства скрипта)");

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("«" + SHEET_NAME + "» парағы табылмады");
  const last = sheet.getLastRow();
  if (last < 2) return;

  const fromDate = new Date(Date.now() - DAYS * 86400000);
  const from = Utilities.formatDate(fromDate, TZ, "yyyy-MM-dd");
  const values = sheet.getRange(2, 1, last - 1, COLS).getValues();

  const rows = [];
  for (const r of values) {
    if (typeof r[0] !== "number" || !(r[3] instanceof Date)) continue; // № және Дата міндетті
    if (Utilities.formatDate(r[3], TZ, "yyyy-MM-dd") < from) continue;
    rows.push(r.map(cell_));
  }
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const isLast = i + CHUNK >= rows.length;
    const payload = { rows: rows.slice(i, i + CHUNK) };
    if (isLast) payload.reconcile = { from: from, nos: rows.map((r) => r[0]) };
    post_(token, payload);
  }
  console.log("AutoMax sync: " + rows.length + " жол жіберілді (" + from + " бастап)");
}
