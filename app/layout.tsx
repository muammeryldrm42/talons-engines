import type { Metadata } from "next";
import "./globals.css";

const title = "Talons Regime Engine";
const description = "Regime-adaptive CMC strategy skill — classifies the market into five regimes, then ranks and position-sizes coins through that lens. Backtestable, agent-consumable.";

export const metadata: Metadata = {
  metadataBase: new URL("https://talons-engines.vercel.app"),
  title: { default: title, template: `%s · ${title}` },
  description,
  applicationName: title,
  keywords: ["crypto", "trading strategy", "market regime", "CoinMarketCap", "AI agent skill", "backtest"],
  openGraph: { title, description, type: "website", siteName: title },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
