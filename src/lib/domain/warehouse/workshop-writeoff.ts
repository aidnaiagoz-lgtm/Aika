import "server-only";
import { prisma } from "@/lib/db";
import { isTestName } from "@/lib/domain/sales-ledger/test-mode";
import { writeOffLines, type WriteOffJob } from "./stock-calc";

/**
 * Қойма 2-кезең (CEO, 2026-11-21): цех заказы «Дайын» болғанда — реестрдегі кожа / съёмный метрі қоймадан шегеріледі.
 * Клиенттің өз кожасы мен тест заказы шегерілмейді. Бір заказ екі рет шегерілмейді (заказ бойынша қозғалыс қосындысы тексеріледі).
 * «Қате басылды — қайтару» → шегерілгені қоймаға қайтады (ADJUST, ештеңе өшірілмейді).
 */

type Actor = { id: string; employee?: { id: string } | null };

async function actorName(a: Actor) {
  if (!a.employee?.id) return null;
  return (await prisma.employee.findUnique({ where: { id: a.employee.id }, select: { fullName: true } }))?.fullName ?? null;
}

export async function writeOffForJob(job: WriteOffJob & { id: string; orderNo: string }, actor: Actor) {
  const lines = writeOffLines(job, isTestName);
  if (!lines.length) return 0;
  const mats = await prisma.material.findMany({ where: { sku: { in: lines.map((l) => l.code) } }, select: { id: true, sku: true } });
  const idBySku = new Map(mats.map((m) => [m.sku, m.id]));
  const name = await actorName(actor);
  let n = 0;
  for (const l of lines) {
    const materialId = idBySku.get(l.code);
    if (!materialId) continue; // каталогта жоқ материал — өткізіп жібереміз
    const done = await prisma.$transaction(async (tx) => {
      const net = await tx.stockMovement.aggregate({ where: { workshopJobId: job.id, materialId }, _sum: { qty: true } });
      if (Number(net._sum.qty ?? 0) < 0) return false; // бұрын шегерілген
      const m = await tx.material.update({ where: { id: materialId }, data: { currentStock: { decrement: l.qty } }, select: { currentStock: true } });
      await tx.stockMovement.create({
        data: { materialId, kind: "OUT", qty: -l.qty, stockAfter: m.currentStock, workshopJobId: job.id, orderNo: job.orderNo, note: "Цех: дайын", createdById: actor.id, createdByName: name },
      });
      return true;
    });
    if (done) n++;
  }
  return n;
}

export async function returnForJob(jobId: string, actor: Actor) {
  const sums = await prisma.stockMovement.groupBy({ by: ["materialId"], where: { workshopJobId: jobId }, _sum: { qty: true } });
  const name = await actorName(actor);
  for (const s of sums) {
    const qty = -Number(s._sum.qty ?? 0);
    if (!(qty > 0)) continue;
    await prisma.$transaction(async (tx) => {
      const m = await tx.material.update({ where: { id: s.materialId }, data: { currentStock: { increment: qty } }, select: { currentStock: true } });
      const job = await tx.workshopJob.findUnique({ where: { id: jobId }, select: { orderNo: true } });
      await tx.stockMovement.create({
        data: { materialId: s.materialId, kind: "ADJUST", qty, stockAfter: m.currentStock, workshopJobId: jobId, orderNo: job?.orderNo ?? null, note: "Цех: «Дайын» қайтарылды", createdById: actor.id, createdByName: name },
      });
    });
  }
}
