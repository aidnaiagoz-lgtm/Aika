import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLeft, parseLedgerMaterial, parseQty, stockStatus } from "./stock-calc";

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
