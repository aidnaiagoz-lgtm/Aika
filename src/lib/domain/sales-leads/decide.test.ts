import { test } from "node:test";
import assert from "node:assert/strict";
import { decideOlxLink, findAutoLeadToMerge, type LeadForLink } from "./decide";

const D = (s: string) => new Date(s + "T00:00:00Z");
const sale = { id: "row1", phoneNorm: "7015551234", channelCode: "OLX_1", date: D("2026-11-09") };
const lead = (o: Partial<LeadForLink>): LeadForLink => ({ id: "L1", account: "OLX_1", date: D("2026-11-01"), status: "NEW", ledgerRowId: null, soldAt: null, ...o });

test("OLX-сатылым → 90 күн ішіндегі лид байланысады", () => {
  assert.deepEqual(decideOlxLink(sale, [lead({})]), { action: "link", leadId: "L1" });
});

test("лид жоқ болса → лид жасалады", () => {
  assert.deepEqual(decideOlxLink(sale, []), { action: "create" });
});

test("90 күннен ескі лид есептелмейді → жаңа лид", () => {
  assert.deepEqual(decideOlxLink(sale, [lead({ date: D("2026-07-01") })]), { action: "create" });
});

test("дубль жоқ: осы жолмен бұрын байланысқан", () => {
  assert.deepEqual(decideOlxLink(sale, [lead({ status: "SOLD", ledgerRowId: "row1", soldAt: D("2026-11-09") })]), {
    action: "none",
    why: "already-linked",
  });
});

test("дубль жоқ: бір тапсырыстың екінші жолы (сол күн, лид басқа жолмен сатылған)", () => {
  const other = { ...sale, id: "row2" };
  assert.deepEqual(decideOlxLink(other, [lead({ status: "SOLD", ledgerRowId: "row1", soldAt: D("2026-11-09") })]), {
    action: "none",
    why: "same-order",
  });
});

test("басқа күнгі қайта сатып алу → жаңа лид (ескісі бұрын сатылған)", () => {
  assert.deepEqual(decideOlxLink(sale, [lead({ status: "SOLD", ledgerRowId: "old", soldAt: D("2026-10-01") })]), { action: "create" });
});

test("аккаунты сәйкес лидке басымдық, сосын ең соңғысы", () => {
  const leads = [lead({ id: "A", account: "OLX_2", date: D("2026-11-08") }), lead({ id: "B", account: "OLX_1", date: D("2026-11-02") })];
  assert.deepEqual(decideOlxLink(sale, leads), { action: "link", leadId: "B" });
  assert.deepEqual(decideOlxLink({ ...sale, channelCode: "OLX_UNKNOWN" }, leads), { action: "link", leadId: "A" });
});

test("ОЛХ емес / телефонсыз → ештеңе", () => {
  assert.deepEqual(decideOlxLink({ ...sale, channelCode: "WHATSAPP" }, [lead({})]), { action: "none", why: "not-olx" });
  assert.deepEqual(decideOlxLink({ ...sale, phoneNorm: null }, [lead({})]), { action: "none", why: "no-phone" });
});

test("тарихты байланыстыру режимі: лид жасамайды", () => {
  assert.deepEqual(decideOlxLink(sale, [], { allowCreate: false }).action, "none");
});

test("кестеден келген лид авто-лидпен біріктіріледі (дубль жоқ)", () => {
  const autos = [{ id: "AUTO", phoneNorm: "7015551234", soldAt: D("2026-11-09"), importKey: null, autoCreated: true }];
  assert.equal(findAutoLeadToMerge({ phoneNorm: "7015551234", date: D("2026-11-05") }, autos), "AUTO");
  assert.equal(findAutoLeadToMerge({ phoneNorm: "7770000000", date: D("2026-11-05") }, autos), null);
  assert.equal(findAutoLeadToMerge({ phoneNorm: "7015551234", date: D("2026-11-05") }, [{ ...autos[0], importKey: "olx1:5" }]), null);
});
