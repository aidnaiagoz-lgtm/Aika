import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnStock, materialCode, writeOffLines, daysFor, daysLeft, fmtRolls, orderQty, parseLedgerMaterial, parseQty, perDayUsage, rollLengthFor, rollsOf, stockStatus } from "./stock-calc";

test("parseLedgerMaterial: код, санат, бірлік", () => {
  assert.deepEqual(parseLedgerMaterial("4050 - Кожа - Жанек ромб қара"), {
    sku: "4050", name: "Жанек ромб қара", category: "LEATHER", unit: "м", sourceLabel: "4050 - Кожа - Жанек ромб қара",
  });
  assert.equal(parseLedgerMaterial("1162 - Жіп - кара")?.category, "THREAD");
  assert.equal(parseLedgerMaterial("1162 - Жіп - кара")?.unit, "катушка");
  assert.equal(parseLedgerMaterial("1052 - Лента - коныр (50м)")?.name, "Лента коныр (50м)");
  assert.equal(parseLedgerMaterial("1162 - Жіп - кара")?.name, "Жіп кара");
  assert.equal(parseLedgerMaterial("5049 - Ева - кара мини")?.name, "Ева кара мини");
  assert.equal(parseLedgerMaterial("5049 - Ева - кара мини")?.category, "EVA");
  assert.equal(parseLedgerMaterial("1041 - Леска - кара")?.category, "FISHING_LINE");
  assert.equal(parseLedgerMaterial("Имитация черный"), null);
  assert.equal(parseLedgerMaterial(null), null);
  assert.equal(parseLedgerMaterial("7001 - Белгісіз - бірдеңе")?.category, "ACCESSORIES");
});

test("stockStatus және daysLeft", () => {
  assert.equal(stockStatus(0, 30, false), "none");
  assert.equal(stockStatus(0, 30, true), "out");
  assert.equal(stockStatus(12.5, 30, true), "low");
  assert.equal(stockStatus(86, 30, true), "ok");
  assert.equal(stockStatus(5, null, true), "ok");
  // Минимумға тең — «Аз қалды»; минимум 0 — ескерілмейді
  assert.equal(stockStatus(800, 800, true), "low");
  assert.equal(stockStatus(800.01, 800, true), "ok");
  assert.equal(stockStatus(5, 0, true), "ok");
  assert.equal(daysLeft(30, 90), 10);
  assert.equal(daysLeft(30, 0), null);
  assert.equal(daysLeft(0, 90), null);
});

test("parseQty", () => {
  assert.equal(parseQty("1 240,5"), 1240.5);
  assert.equal(parseQty("2.15"), 2.15);
  assert.equal(parseQty(""), null);
  assert.equal(parseQty("abc"), null);
});

test("parseMoySkladMatrix: тақырып, топтар, тек цех", async () => {
  const { parseMoySkladMatrix, moySkladCategory } = await import("./stock-calc");
  const m: unknown[][] = [
    ["", "Остатки"],
    [],
    ["", "Код", "Артикул", "Наименование", "Ед.изм.", "Доступно", "Резерв", "Ожидание", "Остаток", "Себестоимость"],
    ["", "Авточехлы"],
    ["", "3097", "3097", "Чехол чер", "шт", 1, 0, 0, 1, 17500],
    ["", "Цех/Материалы / Кожы"],
    ["", 4050, "4050", "Жанек ромб кара", "м", 80, 0, 0, 86.4, 2900],
    ["", "Цех/Ева листы"],
    ["", "5058", "5058", "Ева серый мини", "шт", -295.5, 0, 0, -295.5, 0],
  ];
  const rows = parseMoySkladMatrix(m);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { group: "Цех/Материалы / Кожы", code: "4050", name: "Жанек ромб кара", unit: "м", stock: 86.4, cost: 2900 });
  assert.equal(rows[1].stock, -295.5);
  assert.equal(moySkladCategory("Цех/Жіптер /нитки"), "THREAD");
  assert.equal(moySkladCategory("Авточехлы"), null);
  assert.equal(moySkladCategory("Цех/Материалы / Кожы", "м"), "LEATHER");
  assert.equal(moySkladCategory("Цех/Материалы / Кожы", "шт"), "ACCESSORIES");
  assert.throws(() => parseMoySkladMatrix([["a", "b"]]));
});

test("рулон: әдепкі ұзындық, материалдың өз мәні, санау", () => {
  assert.equal(rollLengthFor("LEATHER", null), 50);
  assert.equal(rollLengthFor("FISHING_LINE", null), 45);
  assert.equal(rollLengthFor("LEATHER", 48), 48);
  assert.equal(rollLengthFor("THREAD", null), null);
  assert.equal(rollLengthFor("EVA", 30), 30);
  assert.equal(rollsOf(800, 50), 16);
  assert.equal(rollsOf(85.15, 50), 1.7);
  assert.equal(rollsOf(90, 45), 2);
  assert.equal(rollsOf(0, 50), null);
  assert.equal(rollsOf(100, null), null);
  assert.equal(fmtRolls(16), "≈ 16 рулон");
});

test("заказ: шұғыл / заказ беру керек / жеткілікті (Қытай — 45 күн)", () => {
  assert.equal(stockStatus(85, null, true, 28), "urgent");
  assert.equal(stockStatus(160, null, true, 53), "order");
  assert.equal(stockStatus(400, null, true, 133), "ok");
  assert.equal(stockStatus(400, null, true, 45), "urgent");
  assert.equal(stockStatus(400, null, true, 60), "order");
  // жеткізу 7 күн (Алматы): 30 күн — жеткілікті, 20 күн (≤ 7 + 15) — заказ беру керек
  assert.equal(stockStatus(60, null, true, 30, 7), "ok");
  assert.equal(stockStatus(60, null, true, 20, 7), "order");
  // шығын белгісіз — қолмен қойылған минимум жұмыс істейді
  assert.equal(stockStatus(80, 80, true, null), "low");
  assert.equal(stockStatus(0, 80, true, 10), "out");
});

test("заказ мөлшері мен шығын қарқыны", () => {
  // күніне 3 м, жеткізу 45 + келесі 60 күн = 315 м − 85 м қалдық = 230 м
  assert.equal(orderQty(85, 3), 230);
  assert.equal(orderQty(400, 3), 0);
  assert.equal(orderQty(10, 0), 0);
  assert.equal(orderQty(0, 2, 7, 60), 134);
  assert.equal(perDayUsage(90, 30), 3);
  assert.equal(perDayUsage(12, 4), 3);
  assert.equal(perDayUsage(6, 1), 2);
  assert.equal(perDayUsage(0, 30), null);
  assert.equal(daysFor(85, 3), 28);
  assert.equal(daysFor(0, 3), null);
  assert.equal(daysFor(85, null), null);
});

test("цех «Дайын» → қоймадан шегеру жолдары", () => {
  const isTest = (n: string | null) => !!n && /тест/i.test(n);
  const base = { manager: "Амина", leatherType: "4050 - Кожа - Жанек ромб қара", leatherMeters: "1.75", leatherOwner: "Өзіміздікі", matType: null, matMeters: null, matOwner: null };
  assert.deepEqual(writeOffLines(base, isTest), [{ code: "4050", qty: 1.75 }]);
  // клиенттің өз кожасы — шегерілмейді
  assert.deepEqual(writeOffLines({ ...base, leatherOwner: "Автомода" }, isTest), []);
  // иесі бос — біздікі
  assert.deepEqual(writeOffLines({ ...base, leatherOwner: null }, isTest), [{ code: "4050", qty: 1.75 }]);
  // кожа + съёмный
  assert.deepEqual(writeOffLines({ ...base, matType: "5049 - Ева - кара мини", matMeters: 0.5, matOwner: null }, isTest), [
    { code: "4050", qty: 1.75 },
    { code: "5049", qty: 0.5 },
  ]);
  // метр жазылмаған / коды жоқ / тест менеджер
  assert.deepEqual(writeOffLines({ ...base, leatherMeters: null }, isTest), []);
  assert.deepEqual(writeOffLines({ ...base, leatherType: "Жанек ромб" }, isTest), []);
  assert.deepEqual(writeOffLines({ ...base, manager: "Аягөз тест" }, isTest), []);
  assert.equal(isOwnStock(" өзіміздікі "), true);
  assert.equal(materialCode("1162 - Жіп - кара"), "1162");
});
