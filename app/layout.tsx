import type { Metadata } from "next";
import { Orbitron, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers"; // Import Providers component
import '@coinbase/onchainkit/styles.css'; // Import OnchainKit styles

// Configure Orbitron font
const orbitron = Orbitron({ 
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-orbitron",
});

// Configure Roboto font
const roboto = Roboto({ 
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Base Archery",
  description: "Mini App on Base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${roboto.variable} antialiased`}>
        {/* Wrap the application with Web3 providers */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}