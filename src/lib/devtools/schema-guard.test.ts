import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findDestructiveChanges, parseSchema } from "./schema-guard";

const BASE = `
model User {
  id        String   @id @default(cuid())
  email     String?  @unique // комментарий
  name      String   @map("full_name")
  status    Status   @default(ACTIVE)
  createdAt DateTime @default(now())
  posts     Post[]
  @@map("users")
}

model Post {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id])
  title  String
}

enum Status {
  ACTIVE
  BLOCKED
}
`;

test("бірдей схема — проблема жоқ", () => {
  assert.deepEqual(findDestructiveChanges(BASE, BASE), []);
});

test("парсер: кесте аты, @map, enum", () => {
  const s = parseSchema(BASE);
  assert.equal(s.models.get("User")?.table, "users");
  assert.equal(s.models.get("User")?.fields.get("name")?.column, "full_name");
  assert.equal(s.models.get("User")?.fields.get("email")?.optional, true);
  assert.deepEqual([...(s.enums.get("Status") ?? [])], ["ACTIVE", "BLOCKED"]);
});

test("қосу рұқсат: жаңа модель, nullable баған, default-ты баған, enum мәні", () => {
  const head = BASE.replace("  posts     Post[]", "  posts     Post[]\n  phone     String?\n  score     Int @default(0)\n  touched   DateTime @updatedAt")
    .replace("  BLOCKED\n", "  BLOCKED\n  ARCHIVED\n")
    .concat("\nmodel Extra {\n  id String @id\n  note String\n}\n");
  assert.deepEqual(findDestructiveChanges(BASE, head), []);
});

test("required → optional рұқсат, relation өрісін өшіру — баған емес", () => {
  const head = BASE.replace("  title  String\n", "  title  String?\n").replace("  posts     Post[]\n", "");
  assert.deepEqual(findDestructiveChanges(BASE, head), []);
});

test("модель өшірілсе — тоқтатады", () => {
  const head = BASE.replace(/model Post \{[\s\S]*?\n\}\n/, "");
  const p = findDestructiveChanges(BASE, head);
  assert.equal(p.length, 1);
  assert.match(p[0], /model Post/);
});

test("баған өшірілсе / аты өзгерсе — тоқтатады", () => {
  const head = BASE.replace("  title  String\n", "  heading String\n");
  const p = findDestructiveChanges(BASE, head);
  assert.ok(p.some((x) => x.includes("Post.title")));
});

test("@map / @@map өзгерсе — тоқтатады", () => {
  const head = BASE.replace('@map("full_name")', '@map("fullname")').replace('@@map("users")', '@@map("people")');
  const p = findDestructiveChanges(BASE, head);
  assert.ok(p.some((x) => x.includes("full_name")));
  assert.ok(p.some((x) => x.includes("users")));
});

test("тип өзгерсе, optional → required болса — тоқтатады", () => {
  const head = BASE.replace("  title  String\n", "  title  Int\n").replace("email     String?", "email     String");
  const p = findDestructiveChanges(BASE, head);
  assert.ok(p.some((x) => x.includes("Post.title") && x.includes("Int")));
  assert.ok(p.some((x) => x.includes("User.email")));
});

test("enum мәні өшірілсе — тоқтатады", () => {
  const head = BASE.replace("  BLOCKED\n", "");
  assert.ok(findDestructiveChanges(BASE, head).some((x) => x.includes("BLOCKED")));
});

test("бар модельге default-сыз міндетті баған — тоқтатады", () => {
  const head = BASE.replace("  title  String\n", "  title  String\n  slug   String\n");
  assert.ok(findDestructiveChanges(BASE, head).some((x) => x.includes("Post.slug")));
});

test("нақты схема өз-өзімен салыстырғанда таза", () => {
  const real = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const parsed = parseSchema(real);
  assert.ok(parsed.models.size > 20);
  assert.deepEqual(findDestructiveChanges(real, real), []);
});

test("бар кестеге жаңа @unique / @@unique — тоқтатады (db push data-loss ескертуі)", () => {
  const head1 = BASE.replace("  title  String\n", "  title  String\n  code   String? @unique\n");
  assert.ok(findDestructiveChanges(BASE, head1).some((x) => x.includes("Post.code")));
  const head2 = BASE.replace("  title  String\n}", "  title  String\n  @@unique([userId, title])\n}");
  assert.ok(findDestructiveChanges(BASE, head2).some((x) => x.includes("@@unique")));
  // жаңа модельдегі @unique — рұқсат
  const head3 = BASE + "\nmodel Fresh {\n  id String @id\n  key String @unique\n}\n";
  assert.deepEqual(findDestructiveChanges(BASE, head3), []);
});
