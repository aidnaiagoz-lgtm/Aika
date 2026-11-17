import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** «Цех» → «Түскен заказдар». Ескі сілтемелер (/workshop?job=… — телефонға келген хабар) заказдың жеке бетіне ашылады. */
export default async function WorkshopPage({ searchParams }: { searchParams: Promise<{ view?: string; job?: string }> }) {
  const sp = await searchParams;
  if (sp.job && /^[a-z0-9]{10,40}$/i.test(sp.job)) redirect(`/workshop/job/${sp.job}`);
  redirect(sp.view === "work" ? "/workshop/sewing" : sp.view === "done" ? "/workshop/ready" : "/workshop/incoming");
}
