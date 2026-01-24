import type { Metadata } from "next";
import { Orbitron, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import '@coinbase/onchainkit/styles.css';

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-orbitron",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-roboto",
});

const APP_URL = process.env.NEXT_PUBLIC_URL || "https://base-archery-game.vercel.app";

export const metadata: Metadata = {
  title: "Base Archery",
  description: "Compete in the Base Archery Tournament. Mint your score as NFT on Base.",
  icons: {
    icon: 'https://base-archery-game.vercel.app/favicon.svg',
    shortcut: 'https://base-archery-game.vercel.app/favicon.svg',
    apple: 'https://base-archery-game.vercel.app/favicon.svg',
  },
  openGraph: {
    title: "Base Archery",
    description: "Compete in the Base Archery Tournament.",
    images: [`${APP_URL}/opengraph-image.png`],
  },
  other: {
    "base:app_id": "696eb06ac0ab25addaaaf6af",
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/opengraph-image.png`,
      button: {
        title: "Play Archery",
        action: {
          type: "launch_frame",
          name: "Base Archery",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/base-logo.png`,
          splashBackgroundColor: "#000010"
        }
      }
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${roboto.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}