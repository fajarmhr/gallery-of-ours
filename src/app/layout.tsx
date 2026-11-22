import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = localFont({ src: "./fonts/Newsreader.woff2", weight: "200 800", variable: "--font-editorial", display: "swap", fallback: ["Georgia"] });
const body = localFont({ src: "./fonts/PlusJakartaSans.woff2", weight: "200 800", variable: "--font-body", display: "swap", fallback: ["Arial"] });
const hand = localFont({ src: "./fonts/Caveat.woff2", weight: "500", variable: "--font-handwriting", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Gallery of Ours", template: "%s · Gallery of Ours" },
  description: "A private home for our family's photos, stories, and little moments worth remembering.",
  applicationName: "Gallery of Ours",
  appleWebApp: { capable: true, title: "Gallery of Ours", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#211e1b" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${hand.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
