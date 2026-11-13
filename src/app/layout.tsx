import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientErrorReporter } from "./ClientErrorReporter";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AUTO MAX — Business OS",
  description: "AutoMax ERP + CRM + AI платформасы",
  // iPhone: «На экран «Домой»» — бөлек қосымша ретінде ашылады (хабарлама үшін қажет)
  appleWebApp: { capable: true, title: "AutoMax", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="kk" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
