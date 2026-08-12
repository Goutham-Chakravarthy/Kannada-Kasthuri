import type { Metadata, Viewport } from "next";
import { Noto_Serif_Kannada } from "next/font/google";
import "./globals.css";

const kannadaFont = Noto_Serif_Kannada({
  variable: "--font-kannada",
  subsets: ["kannada", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Kannada Kasthuri | ಕನ್ನಡ ಕಸ್ತೂರಿ",
  description: "A nostalgic retro radio player for classic Kannada songs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${kannadaFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-black text-white">
        {children}
      </body>
    </html>
  );
}
