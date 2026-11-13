import type { Metadata } from "next";
import { ThemeSync } from "@/components/common/ThemeSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetalCalc — Проектирование металлоконструкций и расчёт стоимости",
  description:
    "Веб-приложение для проектирования металлических конструкций из профильных труб, 2D/3D-визуализации и автоматического расчёта стоимости.",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('metalcalc_theme_v1');
    var theme = (t === 'light' || t === 'dark') ? t : 'dark';
    document.documentElement.dataset.theme = theme;
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[var(--mc-bg-app)] text-[var(--mc-text)] antialiased selection:bg-[#9f4636]/35">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
