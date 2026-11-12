import { test } from "node:test";
import assert from "node:assert/strict";
import { computePay, jobHeadline, leatherNorm, rateAt } from "./calc";

test("leatherNorm: реестрдегі медианалар", () => {
  assert.equal(leatherNorm("3Д - Люкс - салон полный 2 ряд"), 1.75);
  assert.equal(leatherNorm("3Д - салон полный 2 ряд"), 1.75);
  assert.equal(leatherNorm("360 - Премиум - салон полный 2 ряд"), 1.75);
  assert.equal(leatherNorm("5Д - Люкс - салон полный 2 ряд"), 2.0);
  assert.equal(leatherNorm("3Д - Люкс - салон полный 3 ряд"), 2.2);
  assert.equal(leatherNorm("багаж - Люкс - полный"), 2.2);
  assert.equal(leatherNorm("- панель накидка"), null);
  assert.equal(leatherNorm(""), null);
  assert.equal(leatherNorm(null), null);
});

test("rateAt: validFrom бойынша соңғы баға, болмаса әдепкі", () => {
  const rates = [
    { operation: "CUT", price: 1500, validFrom: new Date("2025-01-01") },
    { operation: "CUT", price: 1800, validFrom: new Date("2026-12-01") },
  ];
  assert.equal(rateAt(rates, "CUT", new Date("2026-11-10")), 1500);
  assert.equal(rateAt(rates, "CUT", new Date("2026-12-05")), 1800);
  assert.equal(rateAt([], "BOTTOM", new Date()), 500);
});

test("computePay: операция × баға, дайын еместері есептелмейді", () => {
  const d = new Date("2026-10-10");
  const r = computePay(
    [
      { doneAt: d, cutBy: "Бекзат", joinBy: "Мухаммад", edgeBy: "Бакдаулет", bottomBy: "Бакдаулет" },
      { doneAt: d, cutBy: "Бекзат", joinBy: "Кайрат", edgeBy: "Кайрат", bottomBy: null },
      { doneAt: null, cutBy: "Бекзат", joinBy: null, edgeBy: null, bottomBy: null },
    ],
    [],
  );
  assert.equal(r.jobs, 2);
  const by = Object.fromEntries(r.lines.map((l) => [l.worker, l]));
  assert.equal(by["Бекзат"].counts.CUT, 2);
  assert.equal(by["Бекзат"].sum, 3000);
  assert.equal(by["Бакдаулет"].sum, 2000); // окантовка 1500 + дно 500
  assert.equal(by["Кайрат"].sum, 3000);
  assert.equal(r.total, 3000 + 1500 + 2000 + 3000);
});

test("jobHeadline: клиент деректерінсіз, қысқа", () => {
  assert.equal(
    jobHeadline({ car: "тойота", brand: "тойота хайлюкс", carYear: 2017, product: "3Д - салон полный 2 ряд", leatherType: "4050 - Кожа - Жанек ромб қара" }),
    "тойота хайлюкс 2017 · 3Д - салон полный 2 ряд · Жанек ромб қара",
  );
  assert.equal(jobHeadline({ car: "киа", brand: "спортейдж" }), "киа спортейдж");
});
