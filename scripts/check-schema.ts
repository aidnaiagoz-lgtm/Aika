/**
 * CI: `tsx scripts/check-schema.ts <base.prisma> <head.prisma>`
 * Схема өзгерісі деректі жоғалтуы мүмкін болса — exit 1.
 * Шынымен өшіру керек болса: алдымен иесінен сұраңыз (CLAUDE.md), сосын PR-ға
 * `schema-destructive-approved` белгісін (label) қойыңыз — CI бұл тексерісті өткізіп жібереді.
 */
import { readFileSync } from "node:fs";
import { findDestructiveChanges } from "../src/lib/devtools/schema-guard";

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error("usage: tsx scripts/check-schema.ts <base.prisma> <head.prisma>");
  process.exit(2);
}

const problems = findDestructiveChanges(readFileSync(basePath, "utf8"), readFileSync(headPath, "utf8"));
if (problems.length === 0) {
  console.log("✓ schema.prisma: тек қосатын өзгерістер (немесе өзгеріс жоқ)");
  process.exit(0);
}
console.error("✗ schema.prisma: деректі жоғалтуы мүмкін өзгерістер табылды:");
for (const p of problems) console.error("  - " + p);
console.error("\nБаза ортақ және нақты. Бұл өзгерісті жасамас бұрын иесінен рұқсат алыңыз (CLAUDE.md).");
process.exit(1);
