import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { withLedgerLock } from "./lock";
import { isLeader, LEADER_ROLES } from "@/lib/access";

/**
 * Google-дан екі рет көшіп қалған Продажи жолдары (бір importKey — бірнеше жол). 2026-11-19 табылды: push пен pull бір уақытта
 * жүргенде бір жол екі рет жазылып, рейтинг/айналым артық саналды. Енді құлып бар (withLedgerLock); бұл — бұрынғыларын тазалау.
 */

export async function ledgerDuplicateSummary() {
  const groups = await prisma.salesLedgerRow.groupBy({
    by: ["importKey"],
    where: { importKey: { startsWith: "excel:" } },
    _count: { _all: true },
    having: { importKey: { _count: { gt: 1 } } },
  });
  if (groups.length === 0) return { keys: 0, extraRows: 0, extraSum: 0, sample: [] as number[] };
  const keys = groups.map((g) => g.importKey!).filter(Boolean);
  const rows = await prisma.salesLedgerRow.findMany({ where: { importKey: { in: keys } }, select: { importKey: true, no: true, soldFor: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const seen = new Set<string>();
  let extraRows = 0;
  let extraSum = 0;
  for (const r of rows) {
    if (seen.has(r.importKey!)) {
      extraRows++;
      extraSum += Number(r.soldFor ?? 0);
    } else seen.add(r.importKey!);
  }
  const sample = [...new Set(rows.map((r) => r.no))].sort((a, b) => b - a).slice(0, 12);
  return { keys: keys.length, extraRows, extraSum, sample };
}

/**
 * Бірдей importKey-лі жолдарды біріктіру (құлыпсыз, рұқсатсыз — шақырушы жауап береді). Әр топтан біреуі қалады
 * (байланысы көбі, тең болса — ең ескісі); артығының заказ тауары, лид, касса оқиғасы, цех тапсырмасы соған көшеді
 * (цех тапсырмасы сыймаса — «Алынды»), содан кейін артық көшірме өшеді. keys берілсе — тек солар тексеріледі.
 */
export async function mergeDuplicateGroups(keys?: string[]) {
  if (keys && keys.length === 0) return { groups: 0, removed: 0 };
  const groups = await prisma.salesLedgerRow.groupBy({
    by: ["importKey"],
    where: keys ? { importKey: { in: keys } } : { importKey: { startsWith: "excel:" } },
    _count: { _all: true },
    having: { importKey: { _count: { gt: 1 } } },
  });
  let removed = 0;
  for (const g of groups) {
    const rows = await prisma.salesLedgerRow.findMany({
      where: { importKey: g.importKey },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        workshopJob: { select: { id: true, status: true } },
        _count: { select: { orderItems: true, leads: true, cashEvents: true } },
      },
    });
    const score = (r: (typeof rows)[number]) => (r.workshopJob ? 4 : 0) + r._count.orderItems * 2 + r._count.leads + r._count.cashEvents;
    const keep = rows.reduce((a, b) => (score(b) > score(a) ? b : a), rows[0]);
    let keepHasJob = !!keep.workshopJob;
    for (const d of rows) {
      if (d.id === keep.id) continue;
      await prisma.orderItem.updateMany({ where: { ledgerRowId: d.id }, data: { ledgerRowId: keep.id } });
      await prisma.salesLead.updateMany({ where: { ledgerRowId: d.id }, data: { ledgerRowId: keep.id } });
      // Касса оқиғасы бірегей (ledgerRowId+receiptNo+step) — сыймаса, көшірілмейді (жол өшкенде байланыс бос қалады)
      const events = await prisma.cashHandoverEvent.findMany({ where: { ledgerRowId: d.id }, select: { id: true } });
      for (const e of events) await prisma.cashHandoverEvent.update({ where: { id: e.id }, data: { ledgerRowId: keep.id } }).catch(() => undefined);
      if (d.workshopJob) {
        if (!keepHasJob) {
          await prisma.workshopJob.update({ where: { id: d.workshopJob.id }, data: { ledgerRowId: keep.id } });
          keepHasJob = true;
        } else if (d.workshopJob.status === "NEW" || d.workshopJob.status === "IN_PROGRESS") {
          await prisma.workshopJob.update({ where: { id: d.workshopJob.id }, data: { status: "CANCELLED" } });
        }
      }
      await prisma.salesLedgerRow.delete({ where: { id: d.id } });
      removed++;
    }
  }
  return { groups: groups.length, removed };
}

/** CEO: бұрынғы қосарланғандарды бір батырмамен тазалау (/import). */
export async function removeLedgerDuplicates(actor: SessionUser) {
  if (!isLeader(actor)) throw new Error("Тек CEO тазалай алады");
  return withLedgerLock(async () => {
    const r = await mergeDuplicateGroups();
    await prisma.auditLog.create({
      data: { actorId: actor.id, action: "LEDGER_DEDUPE", entityType: "SalesLedgerRow", entityId: "duplicates", newValue: r },
    });
    return r;
  });
}

/** Синхрондау өзі біріктіргенде — CEO-ға хабар (сайттағы қоңырау). Клиент деректері жазылмайды. */
export async function notifyAutoMerged(removed: number, nos: number[]) {
  if (removed <= 0) return;
  const leaders = await prisma.user.findMany({
    where: { status: "ACTIVE", userRoles: { some: { role: { name: { in: [...LEADER_ROLES] } } } } },
    select: { id: true },
  });
  if (!leaders.length) return;
  await prisma.notification.createMany({
    data: leaders.map((u) => ({
      recipientId: u.id,
      type: "ledger.dedupe",
      title: `Продажи: ${removed} қайталанған жол өзі біріктірілді`,
      body: `№${nos.slice(0, 6).join(", №")} — Google-дан екі рет келген. Айналым дұрыс.`,
      payload: { url: "/rating" },
    })),
  });
}
