import { test } from "node:test";
import assert from "node:assert/strict";
import { almatyToday, formatPhone, isOwnLedgerRow, paidOf, periodDays, phoneNeedles, textNeedle } from "./unified-calc";

test("phoneNeedles: 8/7-мен басталса, онсыз нұсқасы да", () => {
  assert.deepEqual(phoneNeedles("8 701 555"), ["8701555", "701555"]);
  assert.deepEqual(phoneNeedles("+7 (701) 555-12"), ["770155512", "70155512"]);
  assert.deepEqual(phoneNeedles("701555"), ["701555", "01555"]);
  assert.deepEqual(phoneNeedles("12"), []);
  assert.deepEqual(phoneNeedles("Ержан"), []);
});

test("textNeedle: тек цифр болса — жоқ", () => {
  assert.equal(textNeedle("8701"), null);
  assert.equal(textNeedle(" камри "), "камри");
  assert.equal(textNeedle("а"), null);
});

test("isOwnLedgerRow: аты немесе енгізуші бойынша", () => {
  const me = { employeeId: "e1", fullName: "Амина" };
  assert.equal(isOwnLedgerRow({ manager: " амина ", createdById: null }, me), true);
  assert.equal(isOwnLedgerRow({ manager: "Зере", createdById: "e1" }, me), true);
  assert.equal(isOwnLedgerRow({ manager: "Зере", createdById: null }, me), false);
  assert.equal(isOwnLedgerRow({ manager: null, createdById: null }, { employeeId: null, fullName: "" }), false);
});

test("paidOf және formatPhone", () => {
  assert.equal(paidOf({ receipt1Amount: "40000", receipt2Amount: null, receipt3Amount: 5000 }), 45000);
  assert.equal(formatPhone("7015551234"), "+7 701 555 12 34");
  assert.equal(formatPhone("+77015551234"), "+7 701 555 12 34");
  assert.equal(formatPhone("123"), "123");
});

test("periodDays: бүгін, кеше, апта (дүйсенбіден), ай", () => {
  const today = "2026-11-14"; // сенбі
  assert.deepEqual(periodDays("today", today), ["2026-11-14", "2026-11-14"]);
  assert.deepEqual(periodDays("yesterday", today), ["2026-11-13", "2026-11-13"]);
  assert.deepEqual(periodDays("week", today), ["2026-11-09", "2026-11-14"]);
  assert.deepEqual(periodDays("month", today), ["2026-11-01", "2026-11-14"]);
  assert.deepEqual(periodDays("yesterday", "2026-12-01"), ["2026-11-30", "2026-11-30"]);
  assert.equal(periodDays("all", today), null);
  assert.equal(almatyToday(new Date("2026-11-14T20:00:00Z")), "2026-11-15");
});
