import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalModel } from "./car-model";

test("canonicalModel: жиі модельдер ағылшынша", () => {
  assert.equal(canonicalModel("туксон"), "Tucson");
  assert.equal(canonicalModel("спортейдж"), "Sportage");
  assert.equal(canonicalModel("муфаса"), "Mufasa");
  assert.equal(canonicalModel("сантафе"), "Santa Fe");
  assert.equal(canonicalModel("санта фе"), "Santa Fe");
  assert.equal(canonicalModel("кобальт"), "Cobalt");
  assert.equal(canonicalModel("хайландер"), "Highlander");
});

test("canonicalModel: цифрлы модельдер", () => {
  assert.equal(canonicalModel("прадо 150"), "Prado 150");
  assert.equal(canonicalModel("прадо150"), "Prado 150");
  assert.equal(canonicalModel("рав 4"), "RAV4");
  assert.equal(canonicalModel("рав4"), "RAV4");
  assert.equal(canonicalModel("к5"), "K5");
  assert.equal(canonicalModel("х5"), "X5");
  assert.equal(canonicalModel("н6"), "H6");
  assert.equal(canonicalModel("рх 300"), "RX300");
  assert.equal(canonicalModel("лк 200"), "LC200");
  assert.equal(canonicalModel("кс55+"), "CS55 Plus");
  assert.equal(canonicalModel("тиго 7 про"), "Tiggo 7 Pro");
  assert.equal(canonicalModel("55"), "55");
  assert.equal(canonicalModel("75плюс"), "75 Plus");
  assert.equal(canonicalModel("с3про"), "S3 Pro");
  assert.equal(canonicalModel("тиго 7про"), "Tiggo 7 Pro");
  assert.equal(canonicalModel("4руннер"), "4Runner");
  assert.equal(canonicalModel("35мах"), "35 Max");
  assert.equal(canonicalModel("кью м5"), "QM5");
  assert.equal(canonicalModel("х трейл"), "X-Trail");
  assert.equal(canonicalModel("хавал м6"), "Haval M6");
});

test("canonicalModel: латынша — сол күйі (бас әріппен), белгісіз — транслит", () => {
  assert.equal(canonicalModel("song plus"), "Song Plus");
  assert.equal(canonicalModel("zs"), "ZS");
  assert.equal(canonicalModel("ипсум"), "Ipsum");
  assert.equal(canonicalModel("бонго"), "Bongo");
  assert.equal(canonicalModel(""), "");
});
