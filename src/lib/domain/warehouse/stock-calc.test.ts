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
