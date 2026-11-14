import { test } from "node:test";
import assert from "node:assert/strict";
import { groupProducts, kindById, productKind } from "./product-kinds";

test("productKind: кестедегі атаулар", () => {
  assert.equal(productKind("3Д - Люкс - салон полный 2 ряд"), "salon3d");
  assert.equal(productKind("5Д - Премиум - салон полный 2 ряд"), "salon5d");
  assert.equal(productKind("360 - Премиум - салон полный 2 ряд"), "salon360");
  assert.equal(productKind("багаж - Люкс - полный"), "trunk");
  assert.equal(productKind("съемный - Леска - салон полный 2 ряд"), "mat");
  assert.equal(productKind("ева - полик - салон 2 ряд"), "mat");
  assert.equal(productKind("3727 - Чехол - J-3D-DGJ006-YK Кофе-черный"), "cover");
  assert.equal(productKind("3764 - Руль - Руль Алькантара қара"), "wheel");
  assert.equal(productKind("1025 - Подпятник - металл"), "heel");
  assert.equal(productKind("- - панель накидка"), "cape");
  assert.equal(productKind("527047 - органайзер - қара ақ 12"), "organizer");
  assert.equal(productKind("1001 - подушка - ортопедический"), "pillow");
  assert.equal(productKind("2151 - подлокотник - коврик черный ромб"), "armrest");
  assert.equal(productKind("55905 - разное - спрей очиститель"), "other");
  assert.equal(productKind(""), "other");
});

test("kind өрістері: чехолда кожа жоқ, салонда бар", () => {
  assert.equal(kindById("cover").leather, false);
  assert.equal(kindById("salon3d").leather && kindById("salon3d").pockets, true);
  assert.equal(kindById("mat").mat && !kindById("mat").leather, true);
  const g = groupProducts(["3Д - Люкс - x", "1 - Чехол - y", "z"]);
  assert.deepEqual([g.salon3d, g.cover, g.other], [["3Д - Люкс - x"], ["1 - Чехол - y"], ["z"]]);
});
