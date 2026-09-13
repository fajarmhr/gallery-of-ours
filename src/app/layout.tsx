import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Plus_Jakarta_Sans, Share_Tech_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-hand", display: "swap" });
const stamp = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-stamp", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gallery of Ours", template: "%s · Gallery of Ours" },
  description: "A private family album.",
  applicationName: "Gallery of Ours",
  appleWebApp: { capable: true, title: "Gallery of Ours", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe7da" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1512" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${hand.variable} ${stamp.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
