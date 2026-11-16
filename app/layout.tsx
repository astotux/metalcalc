import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { CookieBanner } from "@/components/common/CookieBanner";
import { ThemeSync } from "@/components/common/ThemeSync";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="ru"
      data-theme="dark"
      className={`dark ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[var(--mc-bg-app)] font-sans text-[var(--mc-text)] antialiased selection:bg-[var(--mc-brand)]/35 selection:text-[var(--mc-text)]">
        <ThemeSync />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
