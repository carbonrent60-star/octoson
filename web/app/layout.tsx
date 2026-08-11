import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OctosonBoot from "@/components/performance/octoson-boot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Octoson",
    template: "%s • Octoson",
  },

  description:
    "October community üçün canlı Aura economy, casino, oyunlar, market və progression platforması.",

  applicationName: "Octoson",

  keywords: [
    "Octoson",
    "October",
    "Aura",
    "Discord",
    "economy",
    "casino",
    "games",
    "community",
  ],

  authors: [{ name: "Octoson" }],
  creator: "Octoson",
  publisher: "Octoson",

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  openGraph: {
    type: "website",
    locale: "az_AZ",
    siteName: "Octoson",
    title: "Octoson",
    description:
      "October community üçün canlı Aura economy, casino, oyunlar, market və progression platforması.",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Octoson",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Octoson",
    description:
      "October community üçün canlı Aura economy, casino, oyunlar, market və progression platforması.",
    images: ["/opengraph-image"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="az"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script id="octoson-boot-state" strategy="beforeInteractive">
          {`
            try {
              if (
                localStorage.getItem("octoson:boot:v1") === "1"
              ) {
                document.documentElement.classList.add(
                  "octo-boot-seen"
                );
              }
            } catch (_) {}
          `}
        </Script>
        <OctosonBoot />
        {children}
      </body>
    </html>
  );
}
