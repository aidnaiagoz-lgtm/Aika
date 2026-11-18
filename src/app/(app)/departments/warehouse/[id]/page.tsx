import { redirect } from "next/navigation";

export default async function OldMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/warehouse/material/${encodeURIComponent(id)}`);
}
