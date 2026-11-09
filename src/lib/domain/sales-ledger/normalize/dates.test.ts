import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSheetDate, dateShape } from "./dates";

const iso = (raw: unknown) => {
  const r = parseSheetDate(raw);
  assert.equal(r.ok, true, `күтілді ok: ${String(raw)}`);
  return r.ok ? r.value.toISOString() : "";
};

test("уақыты бар форматтар (Алматы → UTC, −5 сағ)", () => {
  assert.equal(iso("04,11,26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("31.10.26 12-43"), "2026-10-31T07:43:00.000Z");
  assert.equal(iso("04,11,26  13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04.11.26.13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,2026,13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,2026 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("4,11,26 9-05"), "2026-11-04T04:05:00.000Z");
  assert.equal(iso("04,11,26 13,18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04/11/26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,,26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04.11,26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,26 13-185"), "2026-11-04T08:18:00.000Z");
});

test("жабысып қалған: жыл+сағат, ай+жыл", () => {
  assert.equal(iso("04,11,2613-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,1126 13-18"), "2026-11-04T08:18:00.000Z");
});

test("тек күн → UTC түн ортасы", () => {
  assert.equal(iso("04.11.2026"), "2026-11-04T00:00:00.000Z");
  assert.equal(iso("2026-11-04"), "2026-11-04T00:00:00.000Z");
});

test("Excel сериялық саны", () => {
  assert.equal(iso("46327"), "2026-11-01T00:00:00.000Z"); // кестеде: сатылым 01.11.2026, чек 46327
  assert.equal(iso(46327), "2026-11-01T00:00:00.000Z");
  assert.equal(iso(46327.5), "2026-11-01T07:00:00.000Z"); // 12:00 Алматы
});

test("қате мәндер", () => {
  assert.deepEqual(parseSheetDate(""), { ok: false, reason: "empty" });
  assert.deepEqual(parseSheetDate("ертең"), { ok: false, reason: "format" });
  assert.deepEqual(parseSheetDate("31,02,26 10-00"), { ok: false, reason: "range" });
  assert.deepEqual(parseSheetDate("04,13,26 10-00"), { ok: false, reason: "range" });
  assert.deepEqual(parseSheetDate("04,11,262 10-00"), { ok: false, reason: "format" });
});

test("dateShape — мәнді емес, пішінін көрсетеді", () => {
  assert.equal(dateShape("04,11,26 13-18"), "99,99,99 99-99");
});

test("ерекше бөлгіштер", () => {
  assert.equal(iso("04,11,26 13;18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,26 13 18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,26 13--18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,26 13-,18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,,11,26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,26 13-18\\"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04..11.26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04 11 26 13-18"), "2026-11-04T08:18:00.000Z");
  assert.equal(iso("04,11,2026 13 18"), "2026-11-04T08:18:00.000Z");
});
