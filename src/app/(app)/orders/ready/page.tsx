import { getCurrentUser } from "@/lib/auth";
import { isLeader } from "@/lib/access";
import { listReady } from "@/lib/domain/orders/workflow";
import { FlowPage } from "../flow-page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  // Менеджер — тек өзінікі; басшыға әдепкі «Барлығы»
  const who = isLeader(user) ? (sp.who === "mine" ? "mine" : "all") : "mine";
  const rows = await listReady(user, who);
  return <FlowPage kind="ready" rows={rows} who={who} user={user} />;
}
