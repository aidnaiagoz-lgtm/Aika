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
