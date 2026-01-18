import "./globals.css";

export const metadata = {
  title: "Base Archery",
  description: "Mini App on Base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}