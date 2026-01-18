import "./globals.css";

export const metadata = {
  title: "Base Archery Game",
  description: "Shoot arrows, mint your score",
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
