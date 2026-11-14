import { test } from "node:test";
import assert from "node:assert/strict";
import { autoGeneration, generationOptions, originCountryFor } from "./car-data";

test("марка кириллицамен де, латынша да танылады", () => {
  assert.equal(originCountryFor("тойота"), "Жапония");
  assert.equal(originCountryFor("Toyota"), "Жапония");
  assert.equal(originCountryFor("хендай"), "Оңтүстік Корея");
  assert.equal(originCountryFor("киа"), "Оңтүстік Корея");
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
