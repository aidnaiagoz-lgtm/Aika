import { test } from "node:test";
import assert from "node:assert/strict";
import { localizeError, WH } from "./t";

test("қойма сөздігі: орысша көпше түр", () => {
  assert.equal(WH.ru.rollsExact(1), "1 рулон");
  assert.equal(WH.ru.rollsExact(3), "3 рулона");
  assert.equal(WH.ru.rollsExact(5), "5 рулонов");
  assert.equal(WH.ru.rollsExact(12), "12 рулонов");
  assert.equal(WH.ru.rolls(1.7), "≈ 1,7 рулона");
  assert.equal(WH.ru.days(21), "21 день");
  assert.equal(WH.ru.days(28), "28 дней");
  assert.equal(WH.kk.days(28), "28 күн");
  assert.equal(WH.ru.unit("дана"), "шт");
  assert.equal(WH.kk.unit("дана"), "дана");
});

test("қойма қателері: орысшаға", () => {
  assert.equal(localizeError("Минимум дұрыс емес", "ru"), "Неверный минимум");
  assert.equal(localizeError("Минимум дұрыс емес", "kk"), "Минимум дұрыс емес");
  assert.equal(localizeError("«a.png» тым үлкен (600 КБ-тан аз болсын)", "ru"), "«a.png» слишком большой (должен быть меньше 600 КБ)");
  assert.equal(localizeError("белгісіз қате", "ru"), "белгісіз қате");
});

test("сөздіктің екі тілінде де бағандар саны бірдей", () => {
  assert.equal(WH.ru.stock.cols.length, WH.kk.stock.cols.length);
  assert.equal(WH.ru.mat.histCols.length, WH.kk.mat.histCols.length);
  assert.equal(WH.ru.ms.cols.length, WH.kk.ms.cols.length);
  assert.equal(WH.ru.form.pay.length, WH.kk.form.pay.length);
});
