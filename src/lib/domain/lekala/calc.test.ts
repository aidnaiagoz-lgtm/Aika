import { test } from "node:test";
import assert from "node:assert/strict";
import { lekalaKey, lekalaVerdict } from "./calc";

test("lekalaKey: марка/модель қалыпқа келеді", () => {
  assert.equal(lekalaKey("тойота", "камри 70")?.key, lekalaKey("Toyota", "Camry 70")?.key);
  assert.equal(lekalaKey("Kia", "Kia K5")?.model, "K5");
  assert.equal(lekalaKey("", "Tucson"), null);
  assert.equal(lekalaKey("Hyundai", ""), null);
});

test("lekalaVerdict: белгі, тарих, жыл, сұрау", () => {
  const h = { count: 14, minYear: 2018, maxYear: 2021, last: "2026-11-12" };
  assert.equal(lekalaVerdict(h, null, null, 2020).status, "have");
  assert.equal(lekalaVerdict(h, null, null, 2022).status, "have"); // ±1 жыл — сол буын
  assert.equal(lekalaVerdict(h, null, null, 2025).status, "check_year");
  assert.equal(lekalaVerdict(h, null, null, null).status, "have");
  assert.equal(lekalaVerdict(null, null, null, 2024).status, "none");
  assert.equal(lekalaVerdict(null, null, { by: "Амина" }, 2024).status, "asked");
  assert.equal(lekalaVerdict(null, { status: "HAVE", byName: "Бекзат" }, null).status, "have");
  assert.equal(lekalaVerdict(h, { status: "NONE", byName: "Бекзат" }, null).status, "none");
  assert.equal(lekalaVerdict(h, null, null).years, "2018–2021");
});

test("carTitle: анық атау", async () => {
  const { carTitle } = await import("./calc");
  assert.equal(carTitle("хюндай", "хюндай стария").title, "Hyundai Stariya");
  assert.equal(carTitle("тойота", "прадо 150").title, "Toyota Prado 150");
  assert.equal(carTitle("", "").title, "");
  assert.equal(carTitle("хюндай", "хюндай стария").raw, "хюндай стария");
});

test("lekalaProductLabel / lekalaMatLabel / summarizeProducts", async () => {
  const { lekalaProductLabel, lekalaMatLabel, summarizeProducts } = await import("./calc");
  assert.equal(lekalaProductLabel("3Д - Люкс - салон полный 2 ряд"), "3Д · салон полный 2 ряд");
  assert.equal(lekalaProductLabel("5Д - Премиум - салон полный 3 ряд"), "5Д · салон полный 3 ряд");
  assert.equal(lekalaProductLabel("багаж -  - пол / дно"), "Багаж · пол / дно");
  assert.equal(lekalaProductLabel("съемный - Леска - водительский 1"), "Съёмный · Леска · водительский 1");
  assert.equal(lekalaProductLabel("1025 - Подпятник - металл"), null);
  assert.equal(lekalaProductLabel(""), null);
  assert.equal(lekalaMatLabel("1041 - Леска - кара"), "+ Съёмный полик · Леска");
  assert.equal(lekalaMatLabel(null), null);
  const m = new Map([
    ["Багаж · полный", { count: 2, minYear: 2020, maxYear: 2020 }],
    ["3Д · салон полный 2 ряд", { count: 5, minYear: 2018, maxYear: 2021 }],
  ]);
  const s = summarizeProducts(m, 2023);
  assert.equal(s[0].label, "3Д · салон полный 2 ряд");
  assert.equal(s[0].fitsYear, false);
  assert.equal(s[1].years, "2020");
  assert.equal(summarizeProducts(m, 2021)[1].fitsYear, true);
});
