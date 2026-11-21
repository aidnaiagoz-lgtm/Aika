import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestName } from "./test-mode";

test("isTestName: тек «тест» сөзі бар аттар", () => {
  assert.equal(isTestName("Аягөз тест"), true);
  assert.equal(isTestName("Тест"), true);
  assert.equal(isTestName("Ayagoz Test"), true);
  assert.equal(isTestName("Амина"), false);
  assert.equal(isTestName("Тестова Айгүл"), false); // сөз ішінде — тест емес
  assert.equal(isTestName(null), false);
});
