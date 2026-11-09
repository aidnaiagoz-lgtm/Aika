import { test } from "node:test";
import assert from "node:assert/strict";
import { matchChannel, guessLeadReason, OLX_UNKNOWN } from "./dictionaries";
import { parsePayment } from "./payment";
import { canonicalManager } from "./managers";

test("каналдар: регистр, бос орын, ескі нұсқалар", () => {
  assert.deepEqual(matchChannel("ватсап"), { code: "WHATSAPP" });
  assert.deepEqual(matchChannel(" Өзі келді "), { code: "WALK_IN" });
  assert.deepEqual(matchChannel("олх"), { code: OLX_UNKNOWN });
  assert.deepEqual(matchChannel("ОЛХ"), { code: OLX_UNKNOWN });
  assert.deepEqual(matchChannel("сарафанное"), { code: "REFERRAL" });
  assert.deepEqual(matchChannel("Сипуни"), { code: "WHATSAPP" });
  assert.deepEqual(matchChannel("ТикТок"), { code: "TIKTOK" });
  assert.deepEqual(matchChannel("Едыл ага танысы"), { code: "REFERRAL" });
  assert.deepEqual(matchChannel("ОЛХ-2"), { code: "OLX_2" });
  assert.deepEqual(matchChannel("бартер"), { code: null, raw: "бартер" });
  assert.equal(matchChannel(""), null);
});

test("төлем: тәсіл мен шот бөлінеді", () => {
  assert.deepEqual(parsePayment("каспий пэй"), { method: "KASPI_PAY", account: null });
  assert.deepEqual(parsePayment("каспий пэй зере"), { method: "KASPI_PAY", account: "Зере" });
  assert.deepEqual(parsePayment("Халык банк Зере "), { method: "HALYK", account: "Зере" });
  assert.deepEqual(parsePayment("Хоум банк Зере"), { method: "HOME", account: "Зере" });
  assert.deepEqual(parsePayment("Наличными"), { method: "CASH", account: null });
  assert.deepEqual(parsePayment("каспий магазин"), { method: "KASPI_SHOP", account: null });
  assert.deepEqual(parsePayment("каспий голд"), { method: "KASPI_GOLD", account: null });
  assert.deepEqual(parsePayment("удержали с зп"), { method: "SALARY_DEDUCTION", account: null });
  assert.deepEqual(parsePayment("бартер"), { method: null, raw: "бартер" });
});

test("менеджер аттары — бір адам", () => {
  assert.equal(canonicalManager("Назерке2"), "Назерке");
  assert.equal(canonicalManager("Жанерке"), "Жанерке 2");
  assert.equal(canonicalManager("Аружан"), "Аружан 2");
  assert.equal(canonicalManager("Мерей"), "Мерей 2");
  assert.equal(canonicalManager("Зере"), "Зере");
  assert.equal(canonicalManager("  "), null);
});

test("лид себебі түсіндірмеден", () => {
  assert.equal(guessLeadReason("ева оз каламнан табам"), "ONLY_EVA");
  assert.equal(guessLeadReason("Дорого"), "EXPENSIVE");
  assert.equal(guessLeadReason("понедельник приеду"), "WILL_COME");
  assert.equal(guessLeadReason("ойланамын"), "THINKING");
  assert.equal(guessLeadReason("тест"), null);
});
