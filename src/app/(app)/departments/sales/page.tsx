import { redirect } from "next/navigation";

export default function SalesIndexPage() {
  redirect("/departments/sales/dashboard");
}
