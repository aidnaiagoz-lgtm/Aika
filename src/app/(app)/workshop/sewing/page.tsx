import { WorkshopListPage } from "../list-page";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <WorkshopListPage list="sewing" q={q} />;
}
