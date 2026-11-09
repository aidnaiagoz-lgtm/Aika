import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, formatPhone } from "./phone";

const ok = (raw: unknown) => {
  const r = normalizePhone(raw);
  assert.equal(r.ok, true, `күтілді ok: ${String(raw)}`);
  return r.ok ? r.value : "";
};

test("8 / 7 / +7 → 10 цифр", () => {
  assert.equal(ok("87015551234"), "7015551234");
  assert.equal(ok("77015551234"), "7015551234");
  assert.equal(ok("+7 701 555 12 34"), "7015551234");
  assert.equal(ok("8 (701) 555-12-34"), "7015551234");
  assert.equal(ok("7015551234"), "7015551234");
  assert.equal(ok("7 747 629 9234"), "7476299234");
});

test("Excel саны (87015551234.0) және сан түрі", () => {
  assert.equal(ok("87015551234.0"), "7015551234");
  assert.equal(ok(87015551234), "7015551234");
});

test("бірнеше нөмір — біріншісі, multi белгісімен", () => {
  const r = normalizePhone("87015551234 / 87775556677");
  assert.deepEqual(r, { ok: true, value: "7015551234", multi: true });
});

test("бос, қысқа, шетелдік", () => {
  assert.deepEqual(normalizePhone(""), { ok: false, reason: "empty" });
  assert.deepEqual(normalizePhone(null), { ok: false, reason: "empty" });
  assert.deepEqual(normalizePhone("8701555"), { ok: false, reason: "length" });
  assert.deepEqual(normalizePhone("89161234567"), { ok: false, reason: "foreign" });
});

test("formatPhone", () => {
  assert.equal(formatPhone("7015551234"), "8 701 555 12 34");
});
