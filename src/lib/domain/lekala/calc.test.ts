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

test("lekalaProductLabel / lekalaMatLabel", async () => {
  const { lekalaProductLabel, lekalaMatLabel } = await import("./calc");
  assert.equal(lekalaProductLabel("3Д - Люкс - салон полный 2 ряд"), "3Д · салон полный 2 ряд");
  assert.equal(lekalaProductLabel("багаж -  - пол / дно"), "Багаж · пол / дно");
  assert.equal(lekalaProductLabel("съемный - Леска - водительский 1"), "Съёмный · Леска · водительский 1");
  assert.equal(lekalaProductLabel("1025 - Подпятник - металл"), null);
  assert.equal(lekalaProductLabel(""), null);
  assert.equal(lekalaProductLabel("-"), null);
  assert.equal(lekalaProductLabel(" - "), null);
  assert.equal(lekalaMatLabel("1041 - Леска - кара"), "+ Съёмный полик · Леска");
  assert.equal(lekalaMatLabel(null), null);
});

test("groupLekala: буын бойынша / жыл бойынша", async () => {
  const { groupLekala } = await import("./calc");
  const gens = [
    { code: "XU50", from: 2013, to: 2019 },
    { code: "XU70", from: 2019, to: null },
  ];
  const e = [
    { label: "3Д · салон полный 2 ряд", year: 2015, date: "2024-01-02" },
    { label: "3Д · салон полный 2 ряд", year: 2016, date: "2025-03-01" },
    { label: "5Д · салон полный 3 ряд", year: 2021, date: "2025-10-12" },
    { label: "+ Съёмный полик · Леска", year: 2021, date: "2025-10-12" },
    { label: "3Д · салон полный 2 ряд", year: 2019, date: "2023-05-05" },
    { label: "Багаж · полный", year: null, date: null },
  ];
  const g = groupLekala(e, gens, 2022);
  assert.equal(g[0].id, "XU70");
  assert.equal(g[0].current, true);
  assert.equal(g[0].count, 2); // 2021 5Д + 2019 3Д (полик саналмайды)
  assert.equal(g[0].last, "2025-10-12");
  assert.equal(g.find((x) => x.id === "XU50")!.products[0].last, "2025-03-01");
  assert.equal(g.find((x) => x.id === "none")!.title, "Жылы жазылмаған");
  // Буыны тігілмеген жыл — бос, бірақ көрінеді
  const g2 = groupLekala(e.slice(0, 2), gens, 2024);
  assert.equal(g2[0].id, "XU70");
  assert.equal(g2[0].count, 0);
  // Буын белгісіз: ±1 жыл
  const g3 = groupLekala(e, null, 2016);
  assert.equal(g3[0].id, "near");
  assert.equal(g3[0].count, 2);
  assert.equal(groupLekala(e, null, null)[0].id, "all");
});
