import { OrdersTabs } from "./OrdersTabs";

// Ортақ орауыш ЖОҚ (фрагмент): «Барлық заказдар» беті компьютерде main биіктігін толық алады (md:h-full).
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrdersTabs />
      {children}
    </>
  );
}
