import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalMake, KNOWN_MAKES } from "./car-make";

test("canonicalMake: орысша/қазақша жазылуы → ағылшынша", () => {
  assert.equal(canonicalMake("тойота"), "Toyota");
  assert.equal(canonicalMake(" Тайота "), "Toyota");
  assert.equal(canonicalMake("ХЮНДАЙ"), "Hyundai");
  assert.equal(canonicalMake("ренж  ровер"), "Land Rover");
  assert.equal(canonicalMake("byd"), "BYD");
  assert.equal(canonicalMake("Toyota"), "Toyota");
  assert.equal(canonicalMake("ваз"), "Lada");
});

test("canonicalMake: белгісіз — сол күйі, бос — бос", () => {
  assert.equal(canonicalMake("трактор"), "трактор");
  assert.equal(canonicalMake(""), "");
  assert.equal(canonicalMake(null), "");
  assert.ok(KNOWN_MAKES.includes("Mercedes-Benz"));
});
