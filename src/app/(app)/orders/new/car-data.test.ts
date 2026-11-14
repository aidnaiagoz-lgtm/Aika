import { test } from "node:test";
import assert from "node:assert/strict";
import { autoGeneration, generationOptions as genOpts, originCountryFor } from "./car-data";

const generationOptions = (make: string, model: string, year: number | null) => genOpts(make, model, year).map((o) => o.code);

test("марка кириллицамен де, латынша да танылады", () => {
  assert.equal(originCountryFor("тойота"), "Japan");
  assert.equal(originCountryFor("Toyota"), "Japan");
  assert.equal(originCountryFor("хендай"), "South Korea");
  assert.equal(originCountryFor("киа"), "South Korea");
  assert.equal(originCountryFor("белгісіз"), undefined);
});

test("модель өрісінде марка қоса жазылса да танылады", () => {
  assert.deepEqual(generationOptions("тойота", "тойота хайлюкс", null), ["AN120/130"]);
  assert.deepEqual(generationOptions("тойота", "камри", null), ["XV40", "XV50", "XV70", "XV80"]);
  assert.deepEqual(generationOptions("тойота", "ленд крузер прадо", null), ["J120", "J150", "J250"]);
  assert.deepEqual(generationOptions("киа", "спортейдж", null), ["KM", "SL", "QL", "NQ5"]);
});

test("жыл бойынша сүзіледі және бір ғана болса өзі қойылады", () => {
  assert.deepEqual(generationOptions("тойота", "камри", 2019), ["XV70"]);
  assert.equal(autoGeneration("тойота", "камри 70", 2019), "XV70");
  assert.equal(autoGeneration("toyota", "Camry", 2011), undefined);
  assert.equal(autoGeneration("тойота", "камри", null), undefined);
  assert.equal(autoGeneration("тойота", "белгісіз", 2019), undefined);
});

test("модель танылмаса — марканың барлық буындары ұсынылады", () => {
  const all = generationOptions("тойота", "", null);
  assert.ok(all.includes("XV70") && all.includes("J200"));
  assert.deepEqual(generationOptions("лексус", "rx", null), []);
});

test("марка жазылмаса да бүкіл тізім шығады, әр кодтың қасында көлік пен жылдар", () => {
  const all = genOpts("", "", null);
  assert.ok(all.length > 50);
  assert.ok(all.some((o) => o.code === "XV70" && o.label === "Toyota Camry · 2017–2023"));
  assert.ok(all.some((o) => o.code === "NQ5" && o.label === "Kia Sportage · 2021–қазір"));
  assert.deepEqual(genOpts("", "", 2019).find((o) => o.code === "XV70")?.label, "Toyota Camry · 2017–2023");
});

test("танылмаған марка (мыс. BYD сияқты буын коды жоқ) — басқа маркалардың тізімі шықпайды", () => {
  assert.deepEqual(genOpts("BYD", "", null), []);
  assert.deepEqual(genOpts("белгісіз марка", "", null), []);
  assert.equal(originCountryFor("BYD"), "China");
  assert.equal(originCountryFor("бид"), "China");
});
