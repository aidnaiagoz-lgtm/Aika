import { getLocale } from "@/lib/locale";
import { OrdersTabs } from "./OrdersTabs";

// Ортақ орауыш ЖОҚ (фрагмент): «Барлық заказдар» беті компьютерде main биіктігін толық алады (md:h-full).
export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <>
      <OrdersTabs locale={locale} />
      {children}
    </>
  );
}
