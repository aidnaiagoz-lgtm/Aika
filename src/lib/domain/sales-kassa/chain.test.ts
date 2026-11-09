import { test } from "node:test";
import assert from "node:assert/strict";
import { cashReceipts, stageOf, holderOf, nextStep, eventsFromSheet, matchReceiptNo, OWNER_NAME } from "./chain";

const D = (s: string) => new Date(s);
const row = {
  soldFor: 55000,
  date: D("2026-11-09T00:00:00Z"),
  receipts: [
    { no: 1 as const, amount: 25000, method: "наличными", at: D("2026-11-09T05:00:00Z") },
    { no: 2 as const, amount: 30000, method: "каспий пэй зере", at: null },
    { no: 3 as const, amount: 10000, method: "Наличными", at: null },
  ],
};

test("ереже 4: тек қолма-қол чектер, түрі анықталады", () => {
  const c = cashReceipts(row);
  assert.deepEqual(c.map((x) => [x.receiptNo, x.amount, x.kind]), [[1, 25000, "предоплата"], [3, 10000, "доплата"]]);
  assert.equal(cashReceipts({ ...row, receipts: [{ no: 1, amount: 55000, method: "наличными", at: null }] })[0].kind, "100%");
});

test("тізбек: менеджер → ст МОП → Еділ аға", () => {
  const since = D("2026-11-01T00:00:00Z");
  const at = D("2026-11-09T05:00:00Z");
  assert.equal(stageOf([], at, since), "MANAGER");
  const h = { step: "HANDED" as const, toName: "Зере", at };
  assert.equal(stageOf([h], at, since), "HANDED_SENIOR");
  assert.equal(stageOf([h, { step: "SENIOR_RECEIVED", toName: null, at }], at, since), "SENIOR");
  assert.equal(stageOf([h, { step: "SENIOR_RECEIVED", toName: null, at }, { step: "OWNER_RECEIVED", toName: null, at }], at, since), "OWNER");
  assert.equal(stageOf([{ step: "HANDED", toName: OWNER_NAME, at }], at, since), "HANDED_OWNER");
});

test("есеп басталған күнге дейінгі, Еділ аға қабылдамаған чек — архив (қалдыққа кірмейді)", () => {
  const openFrom = D("2026-10-10T00:00:00Z");
  assert.equal(stageOf([], D("2025-05-01T00:00:00Z"), openFrom), "ARCHIVE");
  assert.equal(stageOf([{ step: "SENIOR_RECEIVED", toName: null, at: D("2025-05-02T00:00:00Z") }], D("2025-05-01T00:00:00Z"), openFrom), "ARCHIVE");
  assert.equal(stageOf([{ step: "OWNER_RECEIVED", toName: null, at: D("2025-05-02T00:00:00Z") }], D("2025-05-01T00:00:00Z"), openFrom), "OWNER");
  assert.equal(holderOf("ARCHIVE", "Зере", null, "Зере"), null);
});

test("кім не істей алады", () => {
  const none = { isManagerOfRow: false, isSenior: false, isOwner: false, isLeader: false };
  assert.equal(nextStep("MANAGER", { ...none, isManagerOfRow: true }), "HANDED");
  assert.equal(nextStep("MANAGER", none), null);
  assert.equal(nextStep("HANDED_SENIOR", { ...none, isSenior: true }), "SENIOR_RECEIVED");
  assert.equal(nextStep("HANDED_SENIOR", { ...none, isManagerOfRow: true }), null);
  assert.equal(nextStep("SENIOR", { ...none, isOwner: true }), "OWNER_RECEIVED");
  assert.equal(nextStep("SENIOR", { ...none, isLeader: true }), null); // Еділ ағаның орнына басқа ешкім баспайды
  assert.equal(nextStep("HANDED_OWNER", { ...none, isOwner: true }), "OWNER_RECEIVED");
});

test("ескі касса парағы → оқиғалар", () => {
  const at = D("2026-01-04T00:00:00Z");
  assert.deepEqual(eventsFromSheet({ givenTo: "Зере", seniorOk: true, ownerOk: false, at }).map((e) => e.step), ["HANDED", "SENIOR_RECEIVED"]);
  assert.deepEqual(eventsFromSheet({ givenTo: "Еділ мырза", seniorOk: false, ownerOk: true, at }).map((e) => [e.step, e.toName]), [
    ["HANDED", OWNER_NAME],
    ["OWNER_RECEIVED", null],
  ]);
  assert.deepEqual(eventsFromSheet({ givenTo: "", seniorOk: false, ownerOk: false, at }), []);
});

test("ескі парақтағы соманы чекпен сәйкестендіру", () => {
  const c = cashReceipts(row);
  assert.equal(matchReceiptNo(c, 10000), 3);
  assert.equal(matchReceiptNo(c, 999), 1);
  assert.equal(matchReceiptNo([], null), 1);
});
