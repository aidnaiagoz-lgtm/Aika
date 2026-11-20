import { test } from "node:test";
import assert from "node:assert/strict";
import { chunksComplete, isUploadId, TRAINING_CHUNK_BYTES as C, TRAINING_PDF_MAX_BYTES } from "./index";

test("chunksComplete: бір бөлікті кішкене файл", () => {
  assert.equal(chunksComplete([{ index: 0, size: 1000 }], 1000), true);
  assert.equal(chunksComplete([{ index: 0, size: 999 }], 1000), false);
});

test("chunksComplete: бірнеше бөлік, ретсіз келсе де", () => {
  const size = C * 2 + 10;
  assert.equal(chunksComplete([{ index: 2, size: 10 }, { index: 0, size: C }, { index: 1, size: C }], size), true);
});

test("chunksComplete: бөлік жетіспесе, артық болса не көлем сәйкес келмесе — жоқ", () => {
  const size = C * 2 + 10;
  assert.equal(chunksComplete([{ index: 0, size: C }, { index: 2, size: 10 }], size), false);
  assert.equal(chunksComplete([{ index: 0, size: C }, { index: 1, size: C }, { index: 2, size: 10 }, { index: 3, size: 1 }], size), false);
  assert.equal(chunksComplete([{ index: 0, size: C - 1 }, { index: 1, size: C + 1 }, { index: 2, size: 10 }], size), false);
  assert.equal(chunksComplete([{ index: 0, size: C }, { index: 0, size: C }, { index: 2, size: 10 }], size), false);
});

test("chunksComplete: шектен үлкен не бос файл — жоқ", () => {
  assert.equal(chunksComplete([], 0), false);
  assert.equal(chunksComplete([{ index: 0, size: 1 }], TRAINING_PDF_MAX_BYTES + 1), false);
});

test("isUploadId", () => {
  assert.equal(isUploadId("0123456789abcdef0123456789abcdef"), true);
  assert.equal(isUploadId("short"), false);
  assert.equal(isUploadId("../../etc/passwd/aaaaaaaaaaaa"), false);
});
