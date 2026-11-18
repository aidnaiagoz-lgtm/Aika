import { redirect } from "next/navigation";

/** Ескі «Бөлімдер → Қойма» беті жаңа «Қойма ▾» бөліміне көшті (2026-11-18). */
export default function WarehouseDepartmentPage() {
  redirect("/warehouse/stock");
}
