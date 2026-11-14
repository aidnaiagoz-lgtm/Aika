import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateReceipts, itemMoney, paymentEnum } from "./sales-order-calc";

const d = "2026-11-14";

test("allocateReceipts: бір тауар — бәрі сол жолда", () => {
  const r = allocateReceipts([90000], [
    { amount: 50000, method: "каспий пэй", date: d },
    { amount: 40000, method: "наличными", date: d },
  ]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].map((p) => p.amount), [50000, 40000]);
});

test("allocateReceipts: сарқырама — бірінші жол толғанша, сосын келесісі", () => {
  const r = allocateReceipts([60000, 30000], [{ amount: 80000, method: "каспий пэй", date: d }]);
  assert.deepEqual(r[0].map((p) => p.amount), [60000]);
  assert.deepEqual(r[1].map((p) => p.amount), [20000]);
});

test("allocateReceipts: 3-тен көп чек 3-шісіне қосылады; артық сома соңғы жолға", () => {
  const pays = [10, 20, 30, 40].map((a) => ({ amount: a, method: "наличными", date: d }));
  const r = allocateReceipts([100], pays);
  assert.deepEqual(r[0].map((p) => p.amount), [10, 20, 70]);
  const over = allocateReceipts([50, 50], [{ amount: 130, method: "наличными", date: d }]);
  assert.deepEqual(over.map((row) => row.map((p) => p.amount)), [[50], [80]]);
});

test("allocateReceipts: төлемсіз — бос жолдар", () => {
  assert.deepEqual(allocateReceipts([1, 2], []), [[], []]);
  assert.deepEqual(allocateReceipts([], [{ amount: 5, method: "x", date: d }]), []);
});

test("paymentEnum және itemMoney", () => {
  assert.equal(paymentEnum("CASH"), "CASH");
  assert.equal(paymentEnum("KASPI_PAY"), "KASPI_PAY");
  assert.equal(paymentEnum(null), "OTHER");
  assert.deepEqual(itemMoney(95000, 90000), { base: 95000, sold: 90000, discount: 5000 });
  assert.deepEqual(itemMoney(null, 40000), { base: 40000, sold: 40000, discount: 0 });
  assert.deepEqual(itemMoney(50000, null), { base: 50000, sold: 50000, discount: 0 });
});
