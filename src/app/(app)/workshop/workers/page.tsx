import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseWorkshop } from "@/lib/access";
import { listWorkers } from "@/lib/domain/workshop";
import { WorkersEditor } from "./WorkersEditor";

export const dynamic = "force-dynamic";

export default async function WorkshopWorkersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canUseWorkshop(user)) redirect("/dashboard");
  const workers = await listWorkers(user, true);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-bold text-text-primary">Цех қызметкерлері</h1>
        <p className="m-0 text-sm text-text-secondary">
          Тапсырмада операцияны кім жасағанын осы тізімнен таңдайсыз. Жұмыстан кеткенді «Тізімнен алу» арқылы жасырыңыз — бұрынғы есептері сақталады.
        </p>
      </div>
      <WorkersEditor workers={workers.map((w) => ({ id: w.id, name: w.name, active: w.active }))} />
    </div>
  );
}
