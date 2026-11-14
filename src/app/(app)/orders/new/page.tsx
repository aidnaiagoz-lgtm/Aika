import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLedgerOptions } from "@/lib/domain/sales-ledger";
import { SalesOrderForm } from "./SalesOrderForm";

// Жаңа заказ — Google «продажи» кестесінің орнына (2026-11). Тізімдер (тауар, кожа, жіп, канал...) кестедегідей.
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.employee) redirect("/orders");
  const branch = await prisma.branch.findFirst({ where: { name: { contains: "Алматы" } }, select: { id: true } });
  const { options, priceByProduct } = branch ? await getLedgerOptions(branch.id) : { options: {}, priceByProduct: {} };
  const emp = await prisma.employee.findUnique({ where: { id: user.employee.id }, select: { fullName: true } });

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="m-0 text-2xl font-bold text-text-primary">Жаңа заказ</h1>
          <p className="m-0 mt-1 text-sm text-text-secondary">Бір рет толтырасыз — Продажи, рейтинг, касса, цех өзі жаңарады.</p>
        </div>
        <Link href="/orders" className="text-sm font-semibold text-accent hover:underline">
          ← Заказдарға оралу
        </Link>
      </div>
      <SalesOrderForm options={options} priceByProduct={priceByProduct} managerName={emp?.fullName ?? "—"} />
    </div>
  );
}
