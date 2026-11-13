import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetalCalc — Проектирование металлоконструкций и расчёт стоимости",
  description:
    "Веб-приложение для проектирования металлических конструкций из профильных труб, 2D/3D-визуализации и автоматического расчёта стоимости.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-[#141619] text-[#e6e8ec] antialiased selection:bg-blue-600/40">
        {children}
      </body>
    </html>
  );
}
