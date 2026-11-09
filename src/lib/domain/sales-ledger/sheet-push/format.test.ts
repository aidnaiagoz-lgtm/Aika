import { test } from "node:test";
import assert from "node:assert/strict";
import { toSheetValues, toSheetCell, isPushedCopy, appsScript, FORMULA_COLS, WRITE_SEGMENTS } from "./format";
import { LEDGER_COLUMNS } from "../fields";

const cols = LEDGER_COLUMNS.map((c) => ({ name: c.name, type: c.type }));

test("формула бағандары бос, қалғаны кестедегідей пішінде", () => {
  const v = toSheetValues(cols, {
    no: 12340, year: 2026, month: "11", date: new Date("2026-11-09T00:00:00Z"), manager: "Зере", customerPhone: "87015551234",
    workshop: "true", price: 55000, soldFor: 40000, remainder: 0, receipt1At: new Date("2026-11-09T09:05:00Z"), payments: "x",
  });
  assert.equal(v.length, 45);
  for (const i of FORMULA_COLS) assert.equal(v[i], "", `баған ${i} бос болуы керек`);
  assert.equal(v[3], "09.11.2026");
  assert.equal(v[4], "Зере");
  assert.equal(v[13], true); // Цех — құсбелгі
  assert.equal(v[23], false); // Кармашки лого — бос құсбелгі
  assert.equal(v[25], 40000); // Продали за
  assert.equal(v[30], "09,11,26 14-05"); // Чек 1 уақыты, Алматы
});

test("жазылатын бөліктер формула бағандарымен қиылыспайды және 45 бағанды қамтиды", () => {
  const covered = new Set<number>();
  for (const [a, b] of WRITE_SEGMENTS) for (let i = a; i <= b; i++) covered.add(i);
  for (const f of FORMULA_COLS) assert.equal(covered.has(f), false);
  assert.equal(covered.size + FORMULA_COLS.size, 45);
});

test("бос / жоқ мәндер", () => {
  assert.equal(toSheetCell({ name: "brand", type: "text" }, null), "");
  assert.equal(toSheetCell({ name: "soldFor", type: "number" }, "abc"), "");
});

test("дубль жоқ: кестедегі көшірмені тану (№ + телефон немесе аты)", () => {
  const site = { no: 12340, phoneNorm: "7015551234", customerName: "Арман" };
  assert.equal(isPushedCopy({ no: 12340, phoneNorm: "7015551234", customerName: "арман" }, site), true);
  assert.equal(isPushedCopy({ no: 12340, phoneNorm: "7770000000", customerName: "Басқа" }, site), false); // басқа сатылым — импортталады
  assert.equal(isPushedCopy({ no: 12341, phoneNorm: "7015551234", customerName: "Арман" }, site), false);
  assert.equal(isPushedCopy({ no: 5, phoneNorm: null, customerName: "Ерлан" }, { no: 5, phoneNorm: null, customerName: "ерлан " }), true);
});

test("Apps Script: токен мен бөліктер ішінде", () => {
  const s = appsScript("abc123", "SHEET_X");
  assert.ok(s.includes('const TOKEN = "abc123"'));
  assert.ok(s.includes('const SPREADSHEET_ID = "SHEET_X"'));
  assert.ok(s.includes("openById(SPREADSHEET_ID)"));
  assert.ok(!s.includes("getActive()"));
  assert.ok(s.includes("[[4,24],[26,26],[28,43],[45,45]]"));
  assert.ok(s.includes("function doPost"));
});
