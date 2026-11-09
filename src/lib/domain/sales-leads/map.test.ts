import { test } from "node:test";
import assert from "node:assert/strict";
import { findLeadHeader, mapLeadRow } from "./map";

const pad = (n: number) => Array.from({ length: n }, () => "");
// olx: S бағанынан (18) — №, Дата, Менеджер, Охват, Клик, Имя, Номер, Канал, Город, марка, коммент
const header = [...pad(18), "№", "Дата", "Менеджер", "Охват", "Клик", "Имя", "Номер", "Канал", "Город", "марка", "коммент"];
const row = [...pad(18), "17", "08.01.2025", "Назерке2", "120", "7", "Арман", "8 701 555 12 34", "телефон", "Оскемен ", "джетур 90+", "ева керек тек"];

test("тақырып жолы S бағанынан табылады (сол жақтағы дашборд елемейді)", () => {
  const h = findLeadHeader([["Кол-во заявок"], pad(30), header]);
  assert.equal(h?.headerIndex, 2);
  assert.equal(h?.cols.no, 18);
  assert.equal(h?.cols.phone, 24);
});

test("жол → лид: кілт, аккаунт, нормаланған телефон, менеджер, себеп", () => {
  const h = findLeadHeader([header])!;
  const l = mapLeadRow("olx1", h.cols, row)!;
  assert.equal(l.importKey, "olx1:17");
  assert.equal(l.account, "OLX_1");
  assert.equal(l.date.toISOString(), "2025-01-08T00:00:00.000Z");
  assert.equal(l.phoneNorm, "7015551234");
  assert.equal(l.managerName, "Назерке");
  assert.equal(l.city, "Оскемен");
  assert.equal(l.reach, 120);
  assert.equal(l.clicks, 7);
  assert.equal(l.reasonGuess, "ONLY_EVA");
});

test("olx новый: Клик/Имя жоқ — сонда да оқылады", () => {
  const h2 = [...pad(18), "№", "Дата", "Менеджер", "Охват", "Номер", "Канал", "Город", "марка", "коммент"];
  const r2 = [...pad(18), "3", "21.10.2025", "Зере", "", "87775556677", "телефон", "Алматы", "старекс", "понедельник приеду"];
  const h = findLeadHeader([h2])!;
  const l = mapLeadRow("olx2", h.cols, r2)!;
  assert.equal(l.importKey, "olx2:3");
  assert.equal(l.account, "OLX_2");
  assert.equal(l.customerName, null);
  assert.equal(l.clicks, null);
  assert.equal(l.reasonGuess, "WILL_COME");
});

test("№ немесе күні жоқ жол өткізіледі", () => {
  const h = findLeadHeader([header])!;
  assert.equal(mapLeadRow("olx1", h.cols, [...pad(18), "", "08.01.2025"]), null);
  assert.equal(mapLeadRow("olx1", h.cols, [...pad(18), "5", ""]), null);
});
